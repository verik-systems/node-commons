'use strict'

const requestId = require('../request-id')
const expect = require('chai').expect

describe('request-id', function () {
  it('should extract request id from the headers', async () => {
    let count = 0
    const req = {
      headers: {
        'x-request-id': '123-456'
      }
    }
    const res = {}
    const next = () => { count++ }

    requestId()(req, res, next)

    expect(count).to.eqls(1)
    expect(req.id).to.eqls('123-456')
  })

  it('should generate request id which is a uuid', async () => {
    let count = 0
    const req = {
      headers: {}
    }
    const res = {}
    const next = () => { count++ }

    requestId()(req, res, next)

    expect(count).to.eqls(1)
    expect(req.id).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })
})
