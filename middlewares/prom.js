'use strict'

const Prometheus = require('prom-client')
const ResponseTime = require('response-time')
const gcStats = require('prometheus-gc-stats')

const defaultOptions = {
  prefix: '',
  customLabels: [],
  normalizeStatus: true,
  requestDurationBuckets: [0.003, 0.03, 0.1, 0.3, 1.5, 10],
  defaultMetricEnabled: false,
  gbMetricEnabled: false
}

/**
 * @param {!Array} buckets - array of numbers, representing the buckets for
 * @param prefix - metrics name prefix
 * request duration
 */
function requestDurationGenerator (labelNames, buckets, prefix = '') {
  return new Prometheus.Histogram({
    name: `${prefix}http_request_duration_seconds`,
    help: 'Duration of HTTP requests in seconds',
    labelNames,
    buckets
  })
}

/**
 * @param prefix - metrics name prefix
 * request counter
 */
function requestCountGenerator (labelNames, prefix = '') {
  return new Prometheus.Counter({
    name: `${prefix}http_requests_total`,
    help: 'Counter for total requests received',
    labelNames
  })
}

/**
 * Normalizes http status codes.
 *
 * Returns strings in the format (2|3|4|5)XX.
 *
 * @param {!number} status - status code of the requests
 * @returns {string} the normalized status code.
 */
function normalizeStatusCode (status) {
  if (status >= 200 && status < 300) {
    return '2xx'
  }

  if (status >= 300 && status < 400) {
    return '3xx'
  }

  if (status >= 400 && status < 500) {
    return '4xx'
  }

  return '5xx'
}

function metricsMiddleware (userOption = {}) {
  const options = { ...defaultOptions, ...userOption }
  const originalLabels = ['route', 'method', 'status']
  options.customLabels = new Set([...originalLabels, ...options.customLabels])
  options.customLabels = [...options.customLabels]

  const { normalizeStatus } = options

  const requestDuration = requestDurationGenerator(
    options.customLabels,
    options.requestDurationBuckets,
    options.prefix
  )

  const requestCount = requestCountGenerator(
    options.customLabels,
    options.prefix
  )

  const up = new Prometheus.Gauge({
    name: 'up',
    help: '1 = up, 0 = not up',
    labelNames: []
  })
  up.set(1)

  if (options.defaultMetricEnabled) {
    Prometheus.collectDefaultMetrics({
      prefix: options.prefix
    })
  }

  if (options.gbMetricEnabled) {
    const startGcStats = gcStats(Prometheus.register, {
      prefix: options.prefix
    })
    startGcStats()
  }

  /**
   * Corresponds to the R(equest rate), E(error rate), and D(uration of requests),
   * of the RED metrics.
   */
  return ResponseTime((req, res, time) => {
    const { method, prom } = req

    // only record metrics with req with req.prom.route
    const route = prom && prom.route
    if (!route) {
      return
    }

    const status = normalizeStatus ? normalizeStatusCode(res.statusCode) : res.statusCode.toString()

    const labels = { route, method, status }

    requestCount.inc(labels)

    // observe normalizing to seconds
    requestDuration.observe(labels, time / 1000)
  })
}

module.exports = {
  metricsMiddleware,
  normalizeStatusCode,
  requestDurationGenerator,
  requestCountGenerator
}
