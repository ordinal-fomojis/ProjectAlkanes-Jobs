import { describe, expect, it, vi } from 'vitest'
import z from 'zod'
import { createRateLimitContext } from '../../../src/utils/rateLimit.js'
import { retrySchemaFetch } from '../../../src/utils/retryFetch.js'
import { unisatFetch, UnisatRateLimitOptions } from '../../../src/utils/unisat/unisatFetch.js'

vi.mock('../../../src/utils/retryFetch.js')

describe('unisatFetch', () => {
  it('should make request with correct parameters and return data on success', async () => {
    const testData = { balance: 1000, address: 'bc1qtest...' }
    vi.mocked(retrySchemaFetch).mockResolvedValueOnce({
      code: 0,
      msg: 'Success',
      data: testData
    })

    const schema = z.object({
      balance: z.number(),
      address: z.string()
    })

    const result = await unisatFetch(schema, '/address/bc1qtest.../balance', undefined)
    expect(result).toEqual(testData)
  })


  it('should throw error when Unisat returns code -1', async () => {
    vi.mocked(retrySchemaFetch).mockResolvedValueOnce({
      code: -1,
      msg: 'Invalid address format',
      data: null
    })

    const schema = z.object({ balance: z.number() })

    await expect(unisatFetch(schema, '/invalid-address/balance', undefined))
      .rejects.toThrow(`Unisat request to /invalid-address/balance failed with message: Invalid address format`)
  })

  it('should throw error when data is null even with success code', async () => {
    vi.mocked(retrySchemaFetch).mockResolvedValueOnce({
      code: 0,
      msg: 'Success',
      data: null
    })

    const schema = z.object({ balance: z.number() })

    await expect(unisatFetch(schema, '/empty-response', undefined))
      .rejects.toThrow('Unisat request to /empty-response failed with message: Success')
  })

  it('should not throw error when data is null is allowNull flag is passed', async () => {
    vi.mocked(retrySchemaFetch).mockResolvedValueOnce({
      code: 0,
      msg: 'Success',
      data: null
    })

    const schema = z.object({ balance: z.number() })

    await expect(unisatFetch(schema, '/empty-response', undefined, true))
      .resolves.toBeNull()
  })

  it('should rate limit to 2.5 requests per second', async () => {
    const testData = { balance: 1000, address: 'bc1qtest...' }
    vi.mocked(retrySchemaFetch).mockResolvedValue({
      code: 0,
      msg: 'Success',
      data: testData
    })

    const schema = z.object({
      balance: z.number(),
      address: z.string()
    })

    const start = performance.now()

    const context = createRateLimitContext(UnisatRateLimitOptions)
    for (let i = 0; i < 6; i++) {
      await unisatFetch(schema, '/address/bc1qtest.../balance', context)
    }
    expect(performance.now() - start).toBeGreaterThanOrEqual(2000)
  })
})
