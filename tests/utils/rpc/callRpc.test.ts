import { describe, expect, it, vi } from "vitest"
import z from "zod"
import { BITCOIN_RPC_URL, NOWNODES_API_KEY } from "../../../src/utils/constants.js"
import { retrySchemaFetch } from "../../../src/utils/retryFetch.js"
import { callRpc } from "../../../src/utils/rpc/callRpc.js"

vi.mock("../../../src/utils/retryFetch.js")

describe('callRpc', () => {
  it('should return correct response from rpc', async () => {
    vi.mocked(retrySchemaFetch).mockResolvedValue({ result: 1234 })

    const response = await callRpc(z.number(), 'getblockcount')
    expect(response).toBe(1234)
  })

  it('should throw error when rpc returns error', async () => {
    vi.mocked(retrySchemaFetch).mockResolvedValue({ error: { code: -1, message: 'RPC error' } })

    await expect(callRpc(z.number(), 'getblockcount', []))
      .rejects.toThrow('Bitcoin RPC error: {"code":-1,"message":"RPC error"}')
  })

  it('should throw unknown error if no error or data is returned', async () => {
    vi.mocked(retrySchemaFetch).mockResolvedValue({})

    await expect(callRpc(z.string(), 'getblockcount', []))
      .rejects.toThrow('Bitcoin RPC error: "Unknown error"')
  })

  it('should provide correct request body', async () => {
    vi.mocked(retrySchemaFetch).mockResolvedValue({ result: 'success' })

    const params = [1, 'test']
    await callRpc(z.string(), 'testmethod', params)

    expect(retrySchemaFetch).toHaveBeenCalledWith(expect.any(z.ZodType), BITCOIN_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': NOWNODES_API_KEY },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: 'testmethod',
        params
      })
    })
  })
})
