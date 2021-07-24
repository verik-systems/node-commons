'use strict'

const pino = require('pino')

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

wrapMethods.forEach(item => {
  Logger.prototype[item] = function (msg, data, ...more) {
    const stringifyAble = data instanceof Error
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

module.exports = function (moduleName) {
  let bindings = {}
  if (moduleName) {
    bindings = { module: moduleName }
  }
  return new Logger(logger.child(bindings))
}
