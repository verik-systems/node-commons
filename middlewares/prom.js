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


/**
 * @param {!Array} buckets - array of numbers, representing the buckets for
 * @param prefix - metrics name prefix
 * request duration
 */
function sqsRequestDurationGenerator (labelNames, buckets, prefix = '', metricNames = []) {
  if (!metricNames.length) return {}
  const results = {}
  metricNames.forEach(name => {
    results[name] = new Prometheus.Histogram({
      name: `${prefix}sqs_${name}_duration_seconds`,
      help: `Duration of sqs ${name} in seconds`,
      labelNames,
      buckets
    })
  })
  return results
}

/**
 * @param prefix - metrics name prefix
 * request counter
 */
function sqsRequestCountGenerator (labelNames, prefix = '', metricNames = []) {
  if (!metricNames.length) return {}
  const results = {}
  metricNames.forEach(name => {
    results[name] = new Prometheus.Counter({
      name: `${prefix}sqs_${name}_total`,
      help: `Counter for ${name} received`,
      labelNames
    })
  })
  return results
}


function sqsMetricsMiddleware (userOption = {}) {
  const options = { ...defaultOptions, ...userOption }
  const originalLabels = ['event', 'consumerId', 'status']
  options.customLabels = new Set([...originalLabels, ...options.customLabels])
  options.customLabels = [...options.customLabels]

  const { normalizeStatus } = options

  const sqsRequestDuration = sqsRequestDurationGenerator(
    options.customLabels,
    options.requestDurationBuckets,
    options.prefix,
    ['message_process', 'message_from_mo']
  )

  const sqsRequestCount = sqsRequestCountGenerator(
    options.customLabels,
    options.prefix,
    ['message_retry', 'message_event', 'message_lastwill', 'message_process', 'consumer_process']
  )

  /** 
   * Corresponds to the R(equest rate), E(error rate), and D(uration of requests),
   * of the RED metrics.
   */ 
  return (({ events, consumerId, status, moId }, time) => {
    if (typeof events === 'string') events = [events]
    if (!events.length) return

    events.forEach((event) => {
      if (sqsRequestDuration[event]) sqsRequestDuration[event].observe({ event }, time / 1000)
      if (sqsRequestCount[event]) {
        const labels = {  }
        if (consumerId) labels.consumerId = consumerId
        if (status) labels.status = status
        if (moId) labels.moId = moId
        sqsRequestCount[event].inc(labels)
      }
    })

    Prometheus.register.metrics()
  })
}

module.exports = {
  metricsMiddleware,
  normalizeStatusCode,
  requestDurationGenerator,
  requestCountGenerator,
  sqsMetricsMiddleware
}
