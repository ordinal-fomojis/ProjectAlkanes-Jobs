import { describe, expect, it, vi } from 'vitest'
import z from 'zod'
import { ORDISCAN_API_KEY } from '../../../src/utils/constants.js'
import { ordiscanFetch } from '../../../src/utils/ordiscan/ordiscanFetch.js'
import { retrySchemaFetch } from '../../../src/utils/retryFetch.js'

vi.mock('../../../src/utils/retryFetch.js')

describe('ordiscanFetch', () => {
  it('should make query with correct parameters and return correct response', async () => {
    const data = { id: '123' }
    vi.mocked(retrySchemaFetch).mockResolvedValueOnce({ data })

    const result = await ordiscanFetch(z.object({ id: z.string() }), 'inscriptions/detail', { id: '123456' })

    expect(result).toEqual(data)
    expect(retrySchemaFetch).toHaveBeenCalledExactlyOnceWith(
      expect.any(z.ZodType),
      `https://api.ordiscan.com/v1/inscriptions/detail?id=123456`,
      {
        headers: {
          'Authorization': `Bearer ${ORDISCAN_API_KEY}`,
        }
      }
    )
  })

  it('should throw an error when no data is returned', async () => {
    vi.mocked(retrySchemaFetch).mockResolvedValue({ error: 'Invalid request' })

    await expect(ordiscanFetch(z.object({ id: z.string() }), 'inscriptions/detail'))
      .rejects.toThrow('Ordiscan error: "Invalid request"')
  })

  it('should throw an error with null message when error is null', async () => {
    vi.mocked(retrySchemaFetch).mockResolvedValue({ error: null })

    await expect(ordiscanFetch(z.object({ id: z.string() }), 'inscriptions/detail'))
      .rejects.toThrow('Ordiscan error: "Unknown error"')
  })

  it('should rate limit to 100 requests per minute', async () => {
    const data = { id: '123' }
    vi.mocked(retrySchemaFetch).mockResolvedValue({ data })
    const start = performance.now()

    await Promise.all(Array.from({ length: 5 }, () =>
      ordiscanFetch(z.object({ id: z.string() }), 'inscriptions/detail', { id: '123456' })
    ))
    expect(performance.now() - start).toBeGreaterThanOrEqual(2400)
  })
})
