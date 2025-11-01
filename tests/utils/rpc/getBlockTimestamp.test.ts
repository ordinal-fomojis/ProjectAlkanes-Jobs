import { describe, expect, it, vi } from 'vitest'
import z from 'zod'
import { callRpc } from '../../../src/utils/rpc/callRpc.js'
import { getBlockTimestamp } from '../../../src/utils/rpc/getBlockTimestamp.js'

vi.mock('../../../src/utils/rpc/callRpc.js')

describe('getBlockTimestamp', () => {
  it.each([
    { time: 1735689600, expected: '2025-01-01T00:00:00.000Z' },
    { time: 1751328000, expected: '2025-07-01T00:00:00.000Z' },
    { time: 1767139200, expected: '2025-12-31T00:00:00.000Z' }
  ])('should return correct date for time $time', async ({ time, expected }) => {
    const hash = '000000000000000000064ba7512eabd5845bfaa6ddaf1b35eb73c2f1c03fbd4a'
    const header = { time }
    const blockHeight = 123456

    vi.mocked(callRpc)
      .mockResolvedValueOnce(hash)
      .mockResolvedValueOnce(header)

    const timestamp = await getBlockTimestamp(blockHeight)

    expect(callRpc).toHaveBeenCalledTimes(2)    
    expect(callRpc).toHaveBeenNthCalledWith(1,
      expect.any(z.ZodType),
      'btc_getblockhash',
      [blockHeight]
    )
    expect(callRpc).toHaveBeenNthCalledWith(2,
      expect.any(z.ZodType),
      'btc_getblockheader',
      [hash]
    )

    expect(timestamp.getTime()).toBe(time * 1000)
    expect(timestamp.toISOString()).toBe(expected)
  })
})
