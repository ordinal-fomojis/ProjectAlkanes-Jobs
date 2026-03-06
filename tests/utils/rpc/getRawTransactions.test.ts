import { describe, expect, it, vi } from "vitest"
import z from "zod"
import { callMultiRpc } from "../../../src/utils/rpc/callMultiRpc.js"
import { getRawTransactions } from "../../../src/utils/rpc/getRawTransactions.js"
import Random from "../../test-utils/Random.js"

vi.mock("../../../src/utils/rpc/callMultiRpc.js")

describe('getRawTransactions', () => {
  it('should call rpc with correct parameters', async () => {
    const mockResponse = [
      { success: true, response: Random.randomHex(100), params: [Random.randomTransactionId()] } as const,
      { success: true, response: Random.randomHex(100), params: [Random.randomTransactionId()] } as const
    ]
    vi.mocked(callMultiRpc).mockResolvedValue(mockResponse)

    const txids = [Random.randomTransactionId(), Random.randomTransactionId()]
    const response = await getRawTransactions(txids)

    expect(callMultiRpc).toHaveBeenCalledWith(
      expect.any(z.ZodType),
      txids.map(id => ['getrawtransaction', [id]])
    )

    expect(response).toEqual(mockResponse)
  })
})
