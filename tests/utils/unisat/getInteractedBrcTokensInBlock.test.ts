import { describe, expect, it, vi } from 'vitest'
import { BrcType } from '../../../src/utils/constants.js'
import { getInteractedBrcTokensInBlock } from '../../../src/utils/unisat/getInteractedBrcTokensInBlock.js'
import { UnisatBrcPath, unisatFetch } from '../../../src/utils/unisat/unisatFetch.js'

vi.mock('../../../src/utils/unisat/unisatFetch.js')

describe.for([
  { type: BrcType.Default },
  { type: BrcType.SixByte }
])('getInteractedTokensInBlock - $type', ({ type }) => {
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

    vi.mocked(unisatFetch)
      .mockResolvedValueOnce(mockResponse)

    const result = await getInteractedBrcTokensInBlock(type, 850000)

    expect(result).toBeInstanceOf(Set)
    expect(result).toEqual(new Set(['ORDI', 'SATS', 'PEPE']))
    expect(unisatFetch).toHaveBeenCalledOnce()
    expect(unisatFetch).toHaveBeenCalledWith(
      expect.any(Object),
      `${UnisatBrcPath[type]}/history-by-height/850000?start=0&limit=500`,
      expect.any(Object)
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

    const result = await getInteractedBrcTokensInBlock(type, 850000)

    expect(result).toBeInstanceOf(Set)
    expect(result.size).toBe(750)
    expect(unisatFetch).toHaveBeenCalledTimes(2)
    
    expect(unisatFetch).toHaveBeenNthCalledWith(1, 
      expect.any(Object),
      `${UnisatBrcPath[type]}/history-by-height/850000?start=0&limit=500`,
      expect.any(Object)
    )
    
    expect(unisatFetch).toHaveBeenNthCalledWith(2,
      expect.any(Object),
      `${UnisatBrcPath[type]}/history-by-height/850000?start=500&limit=500`,
      expect.any(Object)
    )
  })

  it('should handle empty response', async () => {
    const mockResponse = {
      total: 0,
      detail: []
    }

    vi.mocked(unisatFetch)
      .mockResolvedValueOnce(mockResponse)

    const result = await getInteractedBrcTokensInBlock(type, 850000)

    expect(result).toBeInstanceOf(Set)
    expect(result.size).toBe(0)
    expect(unisatFetch).toHaveBeenCalledOnce()
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

    const result = await getInteractedBrcTokensInBlock(type, 850000)

    expect(result).toBeInstanceOf(Set)
    expect(result.size).toBe(3)
    expect(result).toEqual(new Set(['ORDI', 'SATS', 'PEPE']))
  })
})
