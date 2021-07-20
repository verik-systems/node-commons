'use strict'

const logWithModuleName = require('../').log('module-name')

logWithModuleName.infoId('request-id', 'info message', { foo: 'bar info' })
logWithModuleName.errorId('request-id-2', 'error message', { foo: 'bar error' })

// this will not be logged
logWithModuleName.debugId('request-id', 'debug message', { foo: 'bar' })

const logWithoutModule = require('../').log()

logWithoutModule.infoId('request-id', 'info message', { foo: 'bar info' })
logWithoutModule.errorId('request-id-2', 'error message', { foo: 'bar error' })

// this will not be logged
logWithoutModule.debugId('request-id', 'debug message', { foo: 'bar' })
