'use strict'

const { v4: uuidv4 } = require('uuid')
function requestId (options) {
  options = options || {}
  options.headerName = options.headerName || 'x-request-id'
  options.attributeName = options.attributeName || 'id'
  return (req, _res, next) => {
    const randomId = uuidv4()
    if (!req.headers[options.headerName]) {
      req.headers[options.headerName] = randomId
    }

    if (!req[options.attributeName]) {
      req[options.attributeName] = req.headers[options.headerName]
    }

    // add a trace-id for tracing purpose
    req.traceId = req[options.attributeName]
    next()
  }
}

module.exports = requestId
