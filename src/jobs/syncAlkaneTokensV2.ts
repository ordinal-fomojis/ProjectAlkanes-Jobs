import { database } from "../database/database.js"
import { Logger } from "../utils/Logger.js"
import { mapAlkaneTokenToDbModel } from "../utils/mapAlkaneTokenToDbModel.js"
import { createRateLimitContext, RateLimitContext } from "../utils/rateLimit.js"
import { getBlockHeight } from "../utils/rpc/getBlockHeight.js"
import { getAllAlkaneTokens } from "../utils/unisat/getAllAlkaneTokens.js"
import { getBestAlkaneBlockHeight } from "../utils/unisat/getBestAlkaneBlockHeight.js"
import { UnisatRateLimitOptions } from "../utils/unisat/unisatFetch.js"

export async function syncAlkaneTokensV2(log: Logger) {
  const rateLimitContext = createRateLimitContext(UnisatRateLimitOptions)
  
  log.info("Starting Alkane token sync...")

  const lastSyncBlockHeight = (await database.syncStatus.findOne())?.alkaneSyncBlockHeight ?? null
  log.info(`Last synced block height: ${lastSyncBlockHeight?.toString() ?? 'none'}`)

  const currentBlockHeight = await getBlockHeightToSyncTo(lastSyncBlockHeight, rateLimitContext)
  log.info(`Current block height: ${currentBlockHeight.toString()}`)

  if (lastSyncBlockHeight == null) {
    const tokenCount = await initialSync(log, currentBlockHeight, rateLimitContext)
    return { blocksSynced: 0, blocksSkippedOrFailed: 0, tokensUnsynced: 0, syncedTokens: tokenCount, failedToSync: 0 }
  }
}

async function initialSync(log: Logger, blockHeight: number, rateLimitContext: RateLimitContext) {
  log.info(`First sync. Performing initial sync.`)
  const tokens = await getAllAlkaneTokens(rateLimitContext)
  log.info(`Fetched ${tokens.length} Alkane tokens.`)

  await database.withTransaction(async () => {
    await database.syncStatus.updateOne(
      {},
      { $set: { alkaneSyncBlockHeight: blockHeight } },
      { upsert: true }
    )

    if (tokens.length === 0) return

    await database.alkaneTokenV2.bulkWrite(tokens.map(token => {
      return {
        updateOne: {
          filter: { alkaneId: token.alkaneid },
          update: { $set: mapAlkaneTokenToDbModel(token, { synced: true, initialised: true }) },
          upsert: true
        }
      }
    }))
  })

  return tokens.length
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
