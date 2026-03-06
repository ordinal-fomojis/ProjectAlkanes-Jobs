import { describe, expect, it, vi } from "vitest"
import z from "zod"
import { callRpc } from "../../../src/utils/rpc/callRpc.js"
import { getMempoolTransactionIds } from "../../../src/utils/rpc/getMempoolTransactionIds.js"
import Random from "../../test-utils/Random.js"

vi.mock("../../../src/utils/rpc/callRpc.js")

describe('getMempoolTransactionIds', () => {
  it('should call rpc with correct parameters', async () => {
    const mockResponse = Array.from({ length: 20 }, () => Random.randomTransactionId())
    vi.mocked(callRpc).mockResolvedValue(mockResponse)

    const response = await getMempoolTransactionIds()

    expect(callRpc).toHaveBeenCalledWith(expect.any(z.ZodType), 'getrawmempool')

    expect(response).toEqual(mockResponse)
  })
})
