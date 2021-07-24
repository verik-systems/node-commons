'use strict'

const Prometheus = require('prom-client')

async function metricsHandler (_req, res, _next) {
  res.set('Content-Type', Prometheus.register.contentType)
  return res.end(await Prometheus.register.metrics())
}

module.exports = metricsHandler
