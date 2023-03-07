export interface IMetricOptions {
  prefix: string
  customLabels?: string[]
  normalizeStatus?: boolean
  requestDurationBuckets?: number[]
  defaultMetricEnabled?: boolean
  gbMetricEnabled?: boolean
}

export interface IWebhookMetricOptions extends IMetricOptions {
  webhookDurationMetrics?: string[]
}

export interface ISQSMetricOptions extends IMetricOptions {
  durationMetrics?: string[]
  countMetrics?: string[]
  sumMetrics?: string[]
  schema?: string
}

export interface IQueryMetricOptions extends IMetricOptions {
  workerMetrics?: string[]
}
