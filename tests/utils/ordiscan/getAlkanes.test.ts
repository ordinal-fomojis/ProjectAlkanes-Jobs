import { describe, expect, it, vi } from 'vitest'
import z from 'zod'
import { getAlkaneIdsAfterTimestamp, getAlkaneTokens } from '../../../src/utils/ordiscan/getAlkanes.js'
import { ordiscanFetch } from '../../../src/utils/ordiscan/ordiscanFetch.js'

vi.mock('../../../src/utils/ordiscan/ordiscanFetch.js')

describe('getAlkaneTokens', () => {
  it('should return correct data', async () => {
    const token = {
      id: '2:1',
      name: 'Test Alkane',
      symbol: 'TALK',
      logo_url: 'https://example.com/logo.png',
      premined_supply: '100000000',
      amount_per_mint: '10000000',
      mint_count_cap: '10',
      deploy_txid: 'tx123',
      deploy_timestamp: '2025-01-01T00:00:00Z',
      current_supply: '150000000',
      current_mint_count: 5
    }
    vi.mocked(ordiscanFetch).mockResolvedValue(token)

    const alkaneIds = Array.from({ length: 5 }, (_, i) => ({ alkaneId: `2:${(i + 1).toString()}`, clonedFrom: null }))
    const result = await getAlkaneTokens(alkaneIds, 100000)
    
    expect(result.every(r => r.status === 'fulfilled')).toBe(true)
    const data = result.filter(r => r.status === 'fulfilled').map(r => r.value)
    expect(data).toEqual(Array(5).fill({
      alkaneId: '2:1',
      name: 'Test Alkane',
      symbol: 'TALK',
      logoUrl: 'https://example.com/logo.png',
      preminedSupply: "1",
      amountPerMint: "0.1",
      mintCountCap: "10",
      approximateMintCountCap: 10,
      deployTxid: 'tx123',
      deployTimestamp: expect.any(Date),
      currentSupply: "1.5",
      currentMintCount: 5,
      percentageMinted: 50,
      mintedOut: false,
      maxSupply: "2",
      synced: true,
      blockSyncedAt: 100000,
      clonedFrom: null,
      preminePercentage: 50,
      hasPremine: true,
    }))
  })
})

describe('getAlkaneIdsAfterTimestamp', () => {
  it('should return empty array when no alkanes are found', async () => {
    vi.mocked(ordiscanFetch).mockResolvedValueOnce([])

    const result = await getAlkaneIdsAfterTimestamp(new Date('2025-01-01'))

    expect(result).toEqual([])
    expect(ordiscanFetch).toHaveBeenCalledTimes(1)
    expect(ordiscanFetch).toHaveBeenCalledWith(
      expect.any(z.ZodType),
      'alkanes',
      { sort: 'newest', type: 'TOKEN', page: '1' }
    )
  })

  it('should return alkane IDs with timestamps after the minimum timestamp', async () => {
    vi.mocked(ordiscanFetch).mockResolvedValueOnce([
      {
        id: '2:1',
        deploy_timestamp: '2025-01-20T12:00:00Z' // After min timestamp
      },
      {
        id: '2:2',
        deploy_timestamp: '2025-01-18T12:00:00Z' // After min timestamp
      },
      {
        id: '2:3',
        deploy_timestamp: '2025-01-10T12:00:00Z' // Before min timestamp
      }
    ])
    
    const result = await getAlkaneIdsAfterTimestamp(new Date('2025-01-15'))

    expect(result).toEqual([
      expect.objectContaining({ alkaneId: '2:1' }),
      expect.objectContaining({ alkaneId: '2:2' })
    ])
    expect(ordiscanFetch).toHaveBeenCalledTimes(1)
  })

  it('should stop fetching pages once it encounters an alkane before the minimum timestamp', async () => {
    // all after min timestamp
    const page1 = [
      {
        id: '2:1',
        deploy_timestamp: '2025-01-25T12:00:00Z'
      },
      {
        id: '2:2',
        deploy_timestamp: '2025-01-20T12:00:00Z'
      }
    ]
    
    // Second page - mixed (before and after min timestamp)
    const page2 = [
      {
        id: '2:3',
        deploy_timestamp: '2025-01-18T12:00:00Z' // After min timestamp
      },
      {
        id: '2:4',
        deploy_timestamp: '2025-01-10T12:00:00Z' // Before min timestamp
      }
    ]

    vi.mocked(ordiscanFetch)
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2)

    // Act
    const result = await getAlkaneIdsAfterTimestamp(new Date('2025-01-15'))

    // Assert
    expect(result).toEqual([
      expect.objectContaining({ alkaneId: '2:1' }),
      expect.objectContaining({ alkaneId: '2:2' }),
      expect.objectContaining({ alkaneId: '2:3' })
    ])
    expect(ordiscanFetch).toHaveBeenCalledTimes(2)
    expect(ordiscanFetch).toHaveBeenNthCalledWith(
      1,
      expect.any(z.ZodType),
      'alkanes',
      { sort: 'newest', type: 'TOKEN', page: '1' }
    )
    expect(ordiscanFetch).toHaveBeenNthCalledWith(
      2,
      expect.any(z.ZodType),
      'alkanes',
      { sort: 'newest', type: 'TOKEN', page: '2' }
    )
  })

  it('should fetch multiple pages until no more results are found', async () => {
    const page1 = [
      {
        id: '2:1',
        deploy_timestamp: '2025-03-25T12:00:00Z'
      },
      {
        id: '2:2',
        deploy_timestamp: '2025-02-20T12:00:00Z'
      }
    ]
    
    // Second page
    const page2 = [
      {
        id: '2:3',
        deploy_timestamp: '2025-01-18T12:00:00Z'
      }
    ]

    vi.mocked(ordiscanFetch)
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2)
      .mockResolvedValueOnce([])

    const result = await getAlkaneIdsAfterTimestamp(new Date('2024-12-01'))

    expect(result).toEqual([
      expect.objectContaining({ alkaneId: '2:1' }),
      expect.objectContaining({ alkaneId: '2:2' }),
      expect.objectContaining({ alkaneId: '2:3' })
    ])
    expect(ordiscanFetch).toHaveBeenCalledTimes(3)
    expect(ordiscanFetch).toHaveBeenNthCalledWith(
      1,
      expect.any(z.ZodType),
      'alkanes',
      { sort: 'newest', type: 'TOKEN', page: '1' }
    )
    expect(ordiscanFetch).toHaveBeenNthCalledWith(
      2,
      expect.any(z.ZodType),
      'alkanes',
      { sort: 'newest', type: 'TOKEN', page: '2' }
    )
    expect(ordiscanFetch).toHaveBeenNthCalledWith(
      3,
      expect.any(z.ZodType),
      'alkanes',
      { sort: 'newest', type: 'TOKEN', page: '3' }
    )
  })
})
