'use strict'

const promMiddleware = require('../../middlewares/prom')
const expect = require('chai').expect
const express = require('express')
const supertest = require('supertest')
const Prometheus = require('prom-client')

describe('normalizeStatusCode', function () {
  const normalizeStatusCode = promMiddleware.normalizeStatusCode
  it('should normalize 2xx', async () => {
    expect(normalizeStatusCode(200)).to.eqls('2xx')
    expect(normalizeStatusCode(204)).to.eqls('2xx')
  })

  it('should normalize 4xx', async () => {
    expect(normalizeStatusCode(400)).to.eqls('4xx')
    expect(normalizeStatusCode(404)).to.eqls('4xx')
  })

  it('should normalize 4xx', async () => {
    expect(normalizeStatusCode(500)).to.eqls('5xx')
    expect(normalizeStatusCode(501)).to.eqls('5xx')
  })
})

describe('metricsMiddleware', () => {
  beforeEach(() => {
    Prometheus.register.clear()
  })

  it('should contain up 1', async () => {
    const app = express()
    const metricsMiddleware = promMiddleware.metricsMiddleware({})
    app.use(metricsMiddleware)

    const metrics = await Prometheus.register.metrics()
    expect(metrics).to.contains('up 1')
  })

  it('should record a metric', async () => {
  })
})
