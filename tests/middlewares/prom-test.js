'use strict'

const { normalizeStatusCode } = require('../../middlewares/prom')
const expect = require('chai').expect

describe('normalizeStatusCode', function () {
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
