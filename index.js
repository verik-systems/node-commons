'use strict'

module.exports = {
  middlewares: {
    requestId: require('./middlewares/request-id'),
    prom: require('./middlewares/prom').metricsMiddleware,
    context: require('./libs/log').contextMiddleware
  },
  libs: {
    log: require('./libs/log').logger,
    promEnable: require('./libs/prom-enable'),
    promHandler: require('./libs/prom-handler')
  }
}
