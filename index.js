'use strict'

module.exports = {
  middlewares: {
    requestId: require('./middlewares/request-id'),
    prom: require('./middlewares/prom').metricsMiddleware,
    sqsProm: require('./middlewares/prom').sqsMetricsMiddleware,
    dbQueryProm: require('./middlewares/prom').queryMetricsMiddleware,
		all: require('./middlewares/prom')
  },
  libs: {
    log: require('./libs/log'),
    promEnable: require('./libs/prom-enable'),
    promHandler: require('./libs/prom-handler')
  }
}
