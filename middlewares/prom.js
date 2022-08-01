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
function requestDurationGenerator(labelNames, buckets, prefix = '', schema = 'http', kind = 'request') {
	return new Prometheus.Histogram({
		name: `${prefix}${schema}_${kind}_duration_seconds`,
		help: `Duration of ${schema} ${kind}(s) in seconds`,
		labelNames,
		buckets
	})
}

/**
 * @param prefix - metrics name prefix
 * request counter
 */
function requestCountGenerator(labelNames, prefix = '', schema = 'http', kind = 'requests') {
	return new Prometheus.Counter({
		name: `${prefix}${schema}_${kind}_total`,
		help: `Counter for total ${kind} received`,
		labelNames
	})
}

/**
 * @param prefix - metrics name prefix
 * request sum
 */
function requestSumGenerator({ labelNames, prefix = '', schema = 'http', kind = 'requests' }) {
	return new Prometheus.Gauge({
		name: `${prefix}${schema}_${kind}_total`,
		help: `Total ${kind}`,
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
function normalizeStatusCode(status) {
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

function metricsMiddleware(userOption = {}) {
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

function sqsMetricsMiddleware(userOption = {}) {
	const options = { ...defaultOptions, ...userOption }
	const originalLabels = ["event", "consumerId", "status"];
	options.customLabels = new Set([...originalLabels, ...options.customLabels])
	options.customLabels = [...options.customLabels]

	let requestDurations = []
	let requestCounts = []
	let requestSums = []
	if (options.durationMetrics) {
		for (const kind of options.durationMetrics) {
			requestDurations.push(requestDurationGenerator(
				options.customLabels,
				options.requestDurationBuckets,
				options.prefix,
				options.schema,
				kind
			))
		}
	}
	if (options.countMetrics) {
		for (const kind of options.countMetrics) {
			requestDurations.push(requestCountGenerator(
				options.customLabels,
				options.prefix,
				options.schema,
				kind
			))
		}
	}
	if (options.sumMetrics) {
		for (const kind of options.sumMetrics) {
			requestSums.push(requestSumGenerator({
				labelNames: [],
				prefix: options.prefix,
				schema: options.schema,
				kind
			}))
		}
	}
	/**
	 * Corresponds to the R(equest rate), E(error rate), and D(uration of requests),
	 * of the RED metrics.
	 */
	return ({ events, consumerId, status }, value) => {
		if (!events) return
		if (typeof events === "string") events = [events];
		if (!events.length) return;

		for (const event of events) {
			if (requestDurations[event])
				requestDurations[event].observe({ event }, value / 1000);
			if (requestCounts[event]) {
				const labels = {};
				if (consumerId) labels.consumerId = consumerId;
				if (status) labels.status = status;
				requestCounts[event].inc(labels);
			}
			if (requestSums[event]) {
				requestSums[event].set(value)
			}
		}

		Prometheus.register.metrics();
	};
}

module.exports = {
	metricsMiddleware,
	normalizeStatusCode,
	requestDurationGenerator,
	requestCountGenerator,
	sqsMetricsMiddleware,
	requestSumGenerator
}
