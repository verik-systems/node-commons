'use strict'

const { v4: uuidv4 } = require('uuid')

function requestId (options) {
  options = options || {}
  options.headerName = options.headerName || 'x-request-id'
  options.attributeName = options.attributeName || 'id'

  return (req, _res, next) => {
    req[options.attributeName] = req.headers[options.headerName] || uuidv4()
    next()
  }
}

module.exports = requestId
