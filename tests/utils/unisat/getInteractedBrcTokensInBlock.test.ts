import { describe, expect, it, vi } from 'vitest'
import { getInteractedBrcTokensInBlock } from '../../../src/utils/unisat/getInteractedBrcTokensInBlock.js'
import { unisatFetch } from '../../../src/utils/unisat/unisatFetch.js'

vi.mock('../../../src/utils/unisat/unisatFetch.js')

describe('getInteractedTokensInBlock', () => {
  it('should return unique tickers for a single page response', async () => {
    const mockResponse = {
      total: 4,
      detail: [
        { ticker: 'ORDI' },
        { ticker: 'SATS' },
        { ticker: 'PEPE' },
        { ticker: 'SATS' }
      ]
    }

    const sixByteMockResponse = {
      total: 2,
      detail: [
        { ticker: 'potato' },
        { ticker: 'banana' }
      ]
    }

    vi.mocked(unisatFetch)
      .mockResolvedValueOnce(mockResponse)
      .mockResolvedValueOnce(sixByteMockResponse)

    const result = await getInteractedBrcTokensInBlock(850000)

    expect(result).toBeInstanceOf(Set)
    expect(result).toEqual(new Set(['ORDI', 'SATS', 'PEPE', 'potato', 'banana']))
    expect(unisatFetch).toHaveBeenCalledTimes(2)
    expect(unisatFetch).toHaveBeenCalledWith(
      expect.any(Object), // Schema
      '/brc20/history-by-height/850000?start=0&limit=500',
      undefined
    )
    expect(unisatFetch).toHaveBeenCalledWith(
      expect.any(Object), // Schema
      '/brc20-prog/history-by-height/850000?start=0&limit=500',
      undefined
    )
  })

  it('should handle pagination correctly for multiple pages', async () => {
    const firstPageResponse = {
      total: 750,
      detail: Array.from({ length: 500 }, (_, i) => ({ ticker: `TOKEN${i}` }))
    }

    const secondPageResponse = {
      total: 750,
      detail: Array.from({ length: 250 }, (_, i) => ({ ticker: `TOKEN${i + 500}` }))
    }

    vi.mocked(unisatFetch)
      .mockResolvedValueOnce(firstPageResponse)
      .mockResolvedValueOnce(secondPageResponse)
      .mockResolvedValueOnce({ total: 0, detail: [] })

    const result = await getInteractedBrcTokensInBlock(850000)

    expect(result).toBeInstanceOf(Set)
    expect(result.size).toBe(750)
    expect(unisatFetch).toHaveBeenCalledTimes(3)
    
    expect(unisatFetch).toHaveBeenNthCalledWith(1, 
      expect.any(Object),
      '/brc20/history-by-height/850000?start=0&limit=500',
      undefined
    )
    
    expect(unisatFetch).toHaveBeenNthCalledWith(2,
      expect.any(Object),
      '/brc20/history-by-height/850000?start=500&limit=500',
      undefined
    )

    expect(unisatFetch).toHaveBeenNthCalledWith(3,
      expect.any(Object),
      '/brc20-prog/history-by-height/850000?start=0&limit=500',
      undefined
    )
  })

  it('should handle empty response', async () => {
    const mockResponse = {
      total: 0,
      detail: []
    }

    vi.mocked(unisatFetch)
      .mockResolvedValueOnce(mockResponse)
      .mockResolvedValueOnce(mockResponse)

    const result = await getInteractedBrcTokensInBlock(850000)

    expect(result).toBeInstanceOf(Set)
    expect(result.size).toBe(0)
    expect(unisatFetch).toHaveBeenCalledTimes(2)
  })

  it('should deduplicate tickers across pages', async () => {
    const firstPageResponse = {
      total: 4,
      detail: [
        { ticker: 'ORDI' },
        { ticker: 'SATS' }
      ]
    }

    const secondPageResponse = {
      total: 4,
      detail: [
        { ticker: 'SATS' },
        { ticker: 'PEPE' }
      ]
    }

    vi.mocked(unisatFetch)
      .mockResolvedValueOnce(firstPageResponse)
      .mockResolvedValueOnce(secondPageResponse)
      .mockResolvedValueOnce({ total: 0, detail: [] })

    const result = await getInteractedBrcTokensInBlock(850000)

    expect(result).toBeInstanceOf(Set)
    expect(result.size).toBe(3)
    expect(result).toEqual(new Set(['ORDI', 'SATS', 'PEPE']))
  })
})
