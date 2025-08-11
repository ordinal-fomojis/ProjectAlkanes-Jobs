import { database } from "../database/database.js"
import { Logger } from "../utils/Logger.js"
import { getBestBrcBlockHeight } from "../utils/unisat/getBestBrcBlockHeight.js"
import { getInteractedTokensInBlock } from "../utils/unisat/getInteractedTokensInBlock.js"

export async function syncBrctokens(log: Logger) {
  const lastSyncBlockHeight = (await database.syncStatus.findOne())?.brcSyncBlockHeight ?? null
  log.info(`Last synced block height: ${lastSyncBlockHeight?.toString() ?? 'none'}`)
  const currentBlockHeight = await getBestBrcBlockHeight()
  log.info(`Current block height: ${currentBlockHeight.toString()}`)
  const { blocksSynced, blocksSkippedOrFailed, tokensUnsynced }
    = await syncBlocks(log, lastSyncBlockHeight, currentBlockHeight)



  return {
    blocksSynced,
    blocksSkippedOrFailed,
    tokensUnsynced
  }
}

// Fetches tokens interacted with in new blocks. These are marked as unsynced, and the synced block height is updated.
async function syncBlocks(log: Logger, lastSyncHeight: number | null, currentHeight: number) {
  if (lastSyncHeight == null) {
    log.info(`First sync. Skipping block sync.`)
    return { blocksSynced: 0, tokensUnsynced: 0 }
  }

  const tickers = new Set<string>()
  let syncedUpTo = lastSyncHeight
  for (let height = lastSyncHeight + 1; height <= currentHeight; height++) {
    try {
      log.info(`Syncing block height: ${height.toString()}`)
      const tickersThisBlock = await getInteractedTokensInBlock(height)
      log.info(`Found ${tickersThisBlock.size} tokens in block height ${height.toString()}`)
      tickersThisBlock.forEach(ticker => tickers.add(ticker))
      syncedUpTo = height
    } catch (error) {
      log.warn(`Error syncing block height ${height.toString()}: ${error instanceof Error ? error.message : String(error)}. Saving current progress and skipping future blocks until next sync.`)
      break
    }
  }

  const syncedBlocks = syncedUpTo - lastSyncHeight
  const unsyncedBlocks = currentHeight - syncedUpTo
  log.info(`Found ${tickers.size} unique tokens across ${syncedBlocks} synced blocks.`)
  log.info(`Skipped ${unsyncedBlocks} blocks due to errors.`)

  await database.withTransaction(async () => {
    await database.syncStatus.updateOne(
      {},
      { $set: { brcSyncBlockHeight: syncedUpTo } }
    )
    await database.brcToken.updateMany(
      { ticker: { $in: Array.from(tickers) } },
      { $set: { synced: false } },
      { upsert: true }
    )
  })

  return { blocksSynced: syncedBlocks, blocksSkippedOrFailed: unsyncedBlocks, tokensUnsynced: tickers.size }
}
