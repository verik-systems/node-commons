import { Injectable } from "@nestjs/common"
import { Request, Response } from "express"
import * as client from "prom-client"
import { Counter, Gauge, Histogram } from "prom-client"
import * as ResponseTime from "response-time"
import { IMetricOptions, IQueryMetricOptions, ISQSMetricOptions, IWebhookMetricOptions } from "../interfaces"

@Injectable()
export class VerikPrometheusService {
  public defaultOptions: IMetricOptions = {
    prefix: "",
    customLabels: [],
    normalizeStatus: true,
    requestDurationBuckets: [0.003, 0.03, 0.1, 0.3, 1.5, 10],
    defaultMetricEnabled: false,
    gbMetricEnabled: false,
  }
  private emptyOptions: IMetricOptions = {
    prefix: "",
    customLabels: [],
    requestDurationBuckets: [],
  }

  public initWebHookMetric(userOptions: IWebhookMetricOptions = this.emptyOptions) {
    const options = { ...this.defaultOptions, ...userOptions }
    const originalLabels = ["route", "method", "status", "host"]
    options.customLabels = [...originalLabels, ...(options.customLabels as string[])]

    const requestDurations: Record<string, Histogram<string>> = {}

    const requestCounts: Record<string, Counter<string>> = {
      failed: new client.Counter({
        name: `${options.prefix}failed_webhook_count`,
        help: "Total no. of failed webhooks (outgoing)",
        labelNames: options.customLabels,
      }),
    }
    const requestSizeBytes = new client.Histogram({
      name: `${options.prefix}webhook_request_size_bytes`,
      help: "The size of the request in bytes",
      labelNames: options.customLabels,
      buckets: [],
    })

    if (options.webhookDurationMetrics && options.webhookDurationMetrics.length) {
      options.webhookDurationMetrics.forEach((kind) => {
        requestDurations[kind] = this.webhookDurationGenerator(
          options.customLabels || [],
          options.requestDurationBuckets || [],
          options.prefix,
          kind,
        )
        requestCounts[kind] = this.webhookCountGenerator(options.customLabels || [], options.prefix, kind)
      })
    }

    function updateDuration(kind: string, labels: Record<string, any>, inc: number) {
      if (requestDurations[kind]) requestDurations[kind].labels(labels).observe(inc)
      if (requestCounts[kind]) requestCounts[kind].labels(labels).inc(1)
    }

    function updateCount(kind: string, labels: Record<string, any>, inc: number) {
      if (requestCounts[kind]) requestCounts[kind].labels(labels).inc(inc)
    }

    function updateRequestByteSize(labels: Record<string, any>, inc: number) {
      requestSizeBytes.labels(labels).observe(inc)
    }

    return {
      updateDuration,
      updateCount,
      updateRequestByteSize,
    }
  }

  public initSQSMetric(userOptions: ISQSMetricOptions = this.emptyOptions) {
    const options = { ...this.defaultOptions, ...userOptions }
    const originalLabels = ["event", "consumerId", "status"]
    options.customLabels = [...originalLabels, ...(options.customLabels || [])]

    const requestDurations: Record<string, Histogram<string>> = {}
    const requestCounts: Record<string, Counter<string>> = {}
    const requestSums: Record<string, Gauge<string>> = {}
    if (options.durationMetrics) {
      for (const kind of options.durationMetrics) {
        requestDurations[kind] = this.requestDurationGenerator(
          options.customLabels,
          options.requestDurationBuckets || [],
          options.prefix,
          options.schema,
          kind,
        )
      }
    }
    if (options.countMetrics) {
      for (const kind of options.countMetrics) {
        requestCounts[kind] = this.requestCountGenerator(options.customLabels, options.prefix, options.schema, kind)
      }
    }
    if (options.sumMetrics) {
      for (const kind of options.sumMetrics) {
        requestSums[kind] = this.requestSumGenerator(["consumerId"], options.prefix, options.schema, kind)
      }
    }

    /**
     * Corresponds to the R(equest rate), E(error rate), and D(uration of requests),
     * of the RED metrics.
     */
    return (
      {
        events,
        consumerId,
        status,
      }: {
        events: string | string[]
        consumerId?: string
        status?: string
      },
      value?: number,
    ) => {
      if (!events) return
      if (typeof events === "string") events = [events]
      if (!events.length) return

      for (const event of events) {
        if (requestDurations[event]) {
          requestDurations[event].observe({ event }, (value || 0) / 1000)
        }
        if (requestCounts[event]) {
          const labels: { consumerId?: string; status?: string } = {}
          if (consumerId) labels.consumerId = consumerId
          if (status) labels.status = status
          requestCounts[event].inc(labels)
        }
        if (requestSums[event] && consumerId && value) {
          requestSums[event].labels(consumerId).set(value)
        }
      }

      return client.register.metrics()
    }
  }

  public initQueryMetric(userOptions: IQueryMetricOptions = this.emptyOptions) {
    const options = { ...this.defaultOptions, ...userOptions }
    const originalLabels = ["modelName"]
    options.customLabels = [...originalLabels, ...(options.customLabels || [])]

    // const queryDuration = this.queryDurationGenerator(
    //   options.customLabels,
    //   options.requestDurationBuckets || [],
    //   options.prefix,
    // )

    const queryCounter = this.countConnectionRetryGenerator(options.customLabels, options.prefix)
    const gauges: Record<string, Gauge<string>> = {}

    if (options.workerMetrics && options.workerMetrics.length) {
      options.workerMetrics.forEach((kind) => {
        gauges[kind] = this.workerToDbConnectionGenerator(kind, options.prefix)
        gauges[kind].set(0)
      })
    }

    // const NS_PER_SEC = 1e9
    // function hrtimeToSeconds(hrtime: [number, number]) {
    //   const diffInNanoSecond = hrtime[0] * NS_PER_SEC + hrtime[1]
    //   const diffInSeconds = diffInNanoSecond / NS_PER_SEC

    //   return diffInSeconds
    // }

    // function promDBModelTracing(model: any) {
    //   TODO: need to trigger hook on load from on hook
    //   model.createOptionsFromRemotingContext = function (ctx) {
    //     const base = this.base.createOptionsFromRemotingContext(ctx)
    //     return extend(base, {
    //       startTime: process.hrtime(),
    //     })
    //   }
    //   model.observe("loaded", function (ctx, next) {
    //     const { startTime } = ctx.options
    //     if (startTime) {
    //       const diffInHrtime = process.hrtime(startTime)
    //       const diffInSeconds = hrtimeToSeconds(diffInHrtime)
    //       queryDuration.labels({ modelName: model.name }).observe(diffInSeconds)
    //     }
    //     next()
    //   })
    // }

    function updateNoWorkerConnection(kind: string, inc: number) {
      if (gauges[kind]) gauges[kind].set(inc)
    }

    function updateConnectionRetryCounter(inc: number) {
      queryCounter.inc(inc)
    }

    return {
      // promDBModelTracing,
      updateNoWorkerConnection,
      updateConnectionRetryCounter,
    }
  }

  /**
   * Normalizes http status codes.
   *
   * Returns strings in the format (2|3|4|5)XX.
   *
   * @param {!number} status - status code of the requests
   * @returns {string} the normalized status code.
   */
  private normalizeStatusCode(status: number): string {
    if (status >= 200 && status < 300) {
      return "2xx"
    }

    if (status >= 300 && status < 400) {
      return "3xx"
    }

    if (status >= 400 && status < 500) {
      return "4xx"
    }

    return "5xx"
  }

  public metricsMiddleware(userOptions: IMetricOptions = this.emptyOptions) {
    const options = { ...this.defaultOptions, ...userOptions }
    const originalLabels = ["route", "method", "status"]
    options.customLabels = [...originalLabels, ...(options.customLabels || [])]

    const { normalizeStatus } = options

    const requestDuration = this.requestDurationGenerator(
      options.customLabels,
      options.requestDurationBuckets || [],
      options.prefix,
    )

    const requestCount = this.requestCountGenerator(options.customLabels, options.prefix)

    const up = new client.Gauge({
      name: "up",
      help: "1 = up, 0 = not up",
      labelNames: [],
    }) as unknown as Gauge<string>
    up.set(1)

    if (options.defaultMetricEnabled) {
      client.collectDefaultMetrics({
        prefix: options.prefix,
      })
    }

    if (options.gbMetricEnabled) {
      client.collectDefaultMetrics({
        prefix: options.prefix,
      })
    }

    /**
     * Corresponds to the R(equest rate), E(error rate), and D(uration of requests),
     * of the RED metrics.
     */
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
    return ResponseTime((req, res, time) => {
      const { method, prom } = req as Request & { prom?: { route: string } }

      // only record metrics with req with req.prom.route
      const route = prom && prom.route
      if (!route) {
        return
      }

      const status = normalizeStatus
        ? this.normalizeStatusCode((res as Response).statusCode)
        : (res as Response).statusCode.toString()

      const labels: { route: string; method?: string; status?: string } = { route, method, status }

      requestCount.inc(labels)

      // observe normalizing to seconds
      requestDuration.observe(labels, time / 1000)
    })
  }

  /**
   * @param {!Array} buckets - array of numbers, representing the buckets for
   * @param prefix - metrics name prefix
   * query duration
   */
  private queryDurationGenerator(labelNames: string[], buckets: number[], prefix = "") {
    return new client.Histogram({
      name: `${prefix}duration_of_a_query_seconds`,
      help: "The duration of any query being executed by API/SQS workers",
      labelNames,
      buckets,
    }) as unknown as Histogram<string>
  }

  private countConnectionRetryGenerator(labelNames: string[], prefix = "") {
    return new client.Counter({
      name: `${prefix}db_conn_retries`,
      help: "Counter for total connection retries",
      labelNames,
    }) as unknown as Counter<string>
  }

  private workerToDbConnectionGenerator(kind: string, prefix = "") {
    return new client.Gauge({
      name: `${prefix}${kind}_worker_to_db_conn`,
      help: `The no. of ${kind} connections made by API/SQS workers with the SS-DB`,
    }) as unknown as Gauge<string>
  }

  /**
   * @param {!Array} buckets - array of numbers, representing the buckets for
   * @param prefix - metrics name prefix
   * request duration
   */
  private requestDurationGenerator(
    labelNames: string[],
    buckets: number[],
    prefix = "",
    schema = "http",
    kind = "request",
  ) {
    return new client.Histogram({
      name: `${prefix}${schema}_${kind}_duration_seconds`,
      help: `Duration of ${schema} ${kind}(s) in seconds`,
      labelNames,
      buckets,
    }) as unknown as Histogram<string>
  }

  /**
   * @param prefix - metrics name prefix
   * request counter
   */
  private requestCountGenerator(labelNames: string[], prefix = "", schema = "http", kind = "requests") {
    return new client.Counter({
      name: `${prefix}${schema}_${kind}_total`,
      help: `Counter for total ${kind} received`,
      labelNames,
    }) as unknown as Counter<string>
  }

  /**
   * @param prefix - metrics name prefix
   * request sum
   */
  private requestSumGenerator(labelNames: string[], prefix = "", schema = "http", kind = "requests") {
    return new client.Gauge({
      name: `${prefix}${schema}_${kind}_total`,
      help: `Total ${kind}`,
      labelNames,
    }) as unknown as Gauge<string>
  }

  /**
   * @param {!Array} buckets - array of numbers, representing the buckets for
   * @param prefix - metrics name prefix
   * webhook duration
   */
  private webhookDurationGenerator(labelNames: string[], buckets: number[], prefix = "", kind: string) {
    return new client.Histogram({
      name: `${prefix}webhook_${kind}_duration_seconds`,
      help: `Duration of webhook ${kind} in seconds`,
      labelNames,
      buckets,
    }) as unknown as Histogram<string>
  }

  /**
   * @param prefix - metrics name prefix
   * webhook counter
   */
  private webhookCountGenerator(labelNames: string[], prefix = "", kind: string) {
    return new client.Counter({
      name: `${prefix}webhook_${kind}_total`,
      help: `Counter for total webhook ${kind} sent`,
      labelNames,
    }) as unknown as Counter<string>
  }
}
