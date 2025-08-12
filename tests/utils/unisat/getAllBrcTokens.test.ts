import { describe, expect, it, vi } from 'vitest'
import { getAllBrcTokens } from '../../../src/utils/unisat/getAllBrcTokens.js'
import { unisatFetch } from '../../../src/utils/unisat/unisatFetch.js'
import Random from '../../test-utils/Random.js'

vi.mock('../../../src/utils/unisat/unisatFetch.js')

function mockBrcToken(ticker: string) {
  return {
    ticker,
    selfMint: false,
    holdersCount: 1000,
    inscriptionNumber: 123456,
    inscriptionId: `${Random.randomTransactionId()}i0`,
    max: '21000000',
    limit: '1000',
    minted: '10000',
    totalMinted: '10000',
    confirmedMinted: '10000',
    confirmedMinted1h: '100',
    confirmedMinted24h: '1000',
    mintTimes: 10,
    decimal: 18,
    deployHeight: 800000,
    deployBlocktime: 1690000000,
    completeHeight: 850000,
    completeBlocktime: 1690086400,
    inscriptionNumberStart: 1,
    inscriptionNumberEnd: 10
  }
}

describe('getAllBrcTokens', () => {
  it('should return all tokens for a single page response', async () => {
    const mockTokens = [
      mockBrcToken('ORDI'),
      mockBrcToken('SATS'),
      mockBrcToken('PEPE')
    ]

    const mockResponse = {
      total: 3,
      detail: mockTokens
    }

    vi.mocked(unisatFetch).mockResolvedValueOnce(mockResponse)

    const result = await getAllBrcTokens()

    expect(result).toEqual(mockTokens)
    expect(result).toHaveLength(3)
    expect(unisatFetch).toHaveBeenCalledTimes(1)
    expect(unisatFetch).toHaveBeenCalledWith(
      expect.any(Object), // Schema
      '/brc20/status?start=0&limit=500&sort=deploy'
    )
  })

  it('should handle pagination correctly for multiple pages', async () => {
    const firstPageTokens = Array.from({ length: 500 }, (_, i) => mockBrcToken(`TOKEN${i}`))
    const secondPageTokens = Array.from({ length: 250 }, (_, i) => mockBrcToken(`TOKEN${i + 500}`))

    const firstPageResponse = {
      total: 750,
      detail: firstPageTokens
    }

    const secondPageResponse = {
      total: 750,
      detail: secondPageTokens
    }

    vi.mocked(unisatFetch)
      .mockResolvedValueOnce(firstPageResponse)
      .mockResolvedValueOnce(secondPageResponse)

    const result = await getAllBrcTokens()

    expect(result).toHaveLength(750)
    expect(result[0]).toEqual(firstPageTokens[0])
    expect(result[499]).toEqual(firstPageTokens[499])
    expect(result[500]).toEqual(secondPageTokens[0])
    expect(result[749]).toEqual(secondPageTokens[249])
    
    expect(unisatFetch).toHaveBeenCalledTimes(2)
    
    // Verify first page call
    expect(unisatFetch).toHaveBeenNthCalledWith(1, 
      expect.any(Object),
      '/brc20/status?start=0&limit=500&sort=deploy'
    )
    
    // Verify second page call
    expect(unisatFetch).toHaveBeenNthCalledWith(2,
      expect.any(Object),
      '/brc20/status?start=500&limit=500&sort=deploy'
    )
  })

  it('should handle empty response', async () => {
    const mockResponse = {
      total: 0,
      detail: []
    }

    vi.mocked(unisatFetch).mockResolvedValueOnce(mockResponse)

    const result = await getAllBrcTokens()

    expect(result).toEqual([])
    expect(result).toHaveLength(0)
    expect(unisatFetch).toHaveBeenCalledTimes(1)
  })
})
