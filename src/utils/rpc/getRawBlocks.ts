import { Block } from "bitcoinjs-lib"
import z from "zod"
import { callMultiRpc, MultiRpcResponse } from "./callMultiRpc.js"
import { callRpc } from "./callRpc.js"

export async function getRawBlock(height: number) {
  const hash = await callRpc(z.string(), 'btc_getblockhash', [height])
  return await callRpc(z.string(), 'btc_getblock', [hash, 0])
}

type GetRawBlocksResponse = ({ height: number } & MultiRpcResponse<Block, readonly unknown[]>)[]

export async function getRawBlocks(heights: number[]): Promise<GetRawBlocksResponse> {
  const uniqueHeights = Array.from(new Set(heights))
  const hashes = await callMultiRpc(z.string(), uniqueHeights.map(h => ['btc_getblockhash', [h]] as const))

  const failedHashes = hashes.filter(x => !x.success)
    .map<GetRawBlocksResponse[number]>(response => ({ height: response.params[0], ...response }))
  const successfulHashes = hashes.filter(x => x.success)

  const blocks = await callMultiRpc(z.string(), successfulHashes.map(h => ['btc_getblock', [h.response, 0]] as const))

  const hashToHeightMap = new Map(successfulHashes.map(h => [h.response, h.params[0]]))
  const rawBlocks = blocks.map(response => {
    const height = hashToHeightMap.get(response.params[0])
    if (height == null) 
      throw new Error(`Block height not found for hash ${response.params[0]}`)
    
    return response.success
    ? { ...response, height: height, response: Block.fromHex(response.response) }
    : { ...response, height: height }
  })

  return failedHashes.concat(rawBlocks)
}
