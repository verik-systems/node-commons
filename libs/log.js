'use strict'

const { asChindings } = require('./utils')
const pino = require('pino')
const context = require('./async-context')
const { v4: uuidv4 } = require('uuid')

const wrapMethods = ['info', 'error', 'warn', 'debug']

const logLevel = () => {
  const index = wrapMethods.indexOf(process.env.LOG_LEVEL)
  return index > -1 ? wrapMethods[index] : 'info'
}

const logger = pino({
  level: logLevel(),
  timestamp: () => {
    return `,"time":"${new Date().toISOString()}"`
  }
})

function Logger (pinoLogger) {
  this.pinoLogger = pinoLogger
}

wrapMethods.forEach((item) => {
  Logger.prototype[item] = function (msg, data, ...more) {
    const stringifyAble =
      data instanceof Error
        ? {
            // Pull all enumerable properties, supporting properties on custom Errors
            ...data,
            // Explicitly pull Error's non-enumerable properties
            name: data.name,
            message: data.message
          }
        : data

    this.pinoLogger[item]({
      // message
      msg,
      // data
      d: stringifyAble,
      // more data to print
      dEx: more.length > 0 ? more : undefined
    })
  }
})

const wrapRequestIdMethods = ['infoId', 'errorId', 'warnId', 'debugId']

wrapRequestIdMethods.forEach(item => {
  Logger.prototype[item] = function (requestId, msg, data, ...more) {
    const originalFn = item.replace('Id', '')
    this.pinoLogger[originalFn]({
      requestId: requestId,
      msg,
      d: data,
      dEx: more.length > 0 ? more : undefined
    })
  }
})

async function createAsyncContext (bindings, callback) {
  const child = new Logger(
    logger.child(bindings)
  )

  const store = new Map()
  store.set('logger', child)

  return context.run(store, callback)
}

// Generate a unique ID for each incoming request and store a child logger in context
// to always log the request ID
function contextMiddleware (req, res, next) {
  const bindings = { requestId: req.traceId || uuidv4() }

  return createAsyncContext(bindings, next)
}

module.exports = {
  createAsyncContext,
  contextMiddleware,
  logger: function (moduleName) {
    let bindings = {}
    if (moduleName) {
      bindings = { module: moduleName }
    }
    return new Proxy(new Logger(logger.child(bindings)), {
      get (target, property, receiver) {
        target = context.getStore()?.get('logger') || target

        if (property === 'pinoLogger') {
          target.pinoLogger[pino.symbols.chindingsSym] = asChindings(
            target.pinoLogger,
            bindings
          )
        }
        return Reflect.get(target, property, receiver)
      }
    })
  }
}