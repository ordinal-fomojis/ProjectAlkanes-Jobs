import { database } from "../database/database.js"
import { Logger } from "../utils/Logger.js"
import { createRateLimitContext, RateLimitContext } from "../utils/rateLimit.js"
import { getBlockHeight } from "../utils/rpc/getBlockHeight.js"
import { getBestAlkaneBlockHeight } from "../utils/unisat/getBestAlkaneBlockHeight.js"
import { UnisatRateLimitOptions } from "../utils/unisat/unisatFetch.js"

export async function syncAlkaneTokensV2(log: Logger) {
  const rateLimitContext = createRateLimitContext(UnisatRateLimitOptions)
  
  log.info("Starting Alkane token sync...")

  const lastSyncBlockHeight = (await database.syncStatus.findOne())?.alkaneSyncBlockHeight ?? null
  log.info(`Last synced block height: ${lastSyncBlockHeight?.toString() ?? 'none'}`)

  const currentBlockHeight = await getBlockHeightToSyncTo(lastSyncBlockHeight, rateLimitContext)
  log.info(`Current block height: ${currentBlockHeight.toString()}`)

}

async function getBlockHeightToSyncTo(lastSyncedBlockHeight: number | null, rateLimitContext: RateLimitContext) {
  const actualBlockHeight = await getBlockHeight()

  // If we have synced up to the actual block height, then it's not possible for there to be unsynced blocks,
  // so just return the height we've synced to.
  if (lastSyncedBlockHeight != null && lastSyncedBlockHeight >= actualBlockHeight) {
    return actualBlockHeight
  }

  return await getBestAlkaneBlockHeight(rateLimitContext)
}
