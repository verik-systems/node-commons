'use strict'

module.exports = {
  middlewares: {
    requestId: require('./middlewares/requestId'),
    prom: require('./middlewares/prom').metricsMiddleware
  },
  libs: {
    log: require('./libs/log'),
    promEnable: require('./libs/prom-enable'),
    promHandler: require('./libs/prom-handler')
  }
}
