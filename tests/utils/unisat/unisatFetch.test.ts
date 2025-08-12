import { describe, expect, it, vi } from 'vitest'
import z from 'zod'
import { retrySchemaFetch } from '../../../src/utils/retryFetch.js'
import { unisatFetch } from '../../../src/utils/unisat/unisatFetch.js'

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

    const result = await unisatFetch(schema, '/address/bc1qtest.../balance')
    expect(result).toEqual(testData)
  })


  it('should throw error when Unisat returns code -1', async () => {
    vi.mocked(retrySchemaFetch).mockResolvedValueOnce({
      code: -1,
      msg: 'Invalid address format',
      data: null
    })

    const schema = z.object({ balance: z.number() })

    await expect(unisatFetch(schema, '/invalid-address/balance'))
      .rejects.toThrow(`Unisat request to /invalid-address/balance failed with message: Invalid address format`)
  })

  it('should throw error when data is null even with success code', async () => {
    vi.mocked(retrySchemaFetch).mockResolvedValueOnce({
      code: 0,
      msg: 'Success',
      data: null
    })

    const schema = z.object({ balance: z.number() })

    await expect(unisatFetch(schema, '/empty-response'))
      .rejects.toThrow('Unisat request to /empty-response failed with message: Success')
  })

  it('should rate limit to 5 requests per second', async () => {
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

    await Promise.all(Array.from({ length: 11 }, () =>
      unisatFetch(schema, '/address/bc1qtest.../balance')
    ))
    expect(performance.now() - start).toBeGreaterThanOrEqual(2000)
  })
})
