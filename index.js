'use strict'

module.exports = {
  middlewares: {
    requestId: require('./middlewares/requestId')
  },
  libs: {
    log: require('./libs/log')
  }
}
