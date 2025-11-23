import { Block } from "bitcoinjs-lib"
import { decodeAlkaneOpCallsInBlock } from "./decoder.js"
import { getRawBlock } from "./rpc/getRawBlocks.js"

export async function getInteractedAlkaneTokensInBlock(height: number) {
  const rawBlock = await getRawBlock(height)
  return new Set(decodeAlkaneOpCallsInBlock(Block.fromHex(rawBlock)).flatMap(b => b.opcalls).flatMap(o => o.alkaneId))
}
