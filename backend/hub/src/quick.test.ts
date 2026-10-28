import express from 'express'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { quickRoutes } from './quick.ts'

describe('quick expense', () => {
  const server = express().use(quickRoutes()).listen(0)
  let url = ''

  beforeAll(() => {
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hub/api/quick/expense`
  })

  afterAll(() => {
    server.close()
  })

  const post = (body: unknown) =>
    fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

  it.each([
    [{}],
    [{ amount: 0, category: 'utama' }],
    [{ amount: 1.5, category: 'utama' }],
    [{ amount: '5000', category: 'utama' }],
    [{ amount: 5000, category: 'gaji' }]
  ])('rejects %j', async body => {
    expect((await post(body)).status).toBe(400)
  })
})
