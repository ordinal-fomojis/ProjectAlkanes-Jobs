import { database } from "../database/database.js"
import { Logger } from "../utils/Logger.js"
import { getAllBrcTokens } from "../utils/unisat/getAllBrcTokens.js"
import { getBestBrcBlockHeight } from "../utils/unisat/getBestBrcBlockHeight.js"
import { getBrcsByTicker } from "../utils/unisat/getBrcByTicker.js"
import { getInteractedBrcTokensInBlock } from "../utils/unisat/getInteractedBrcTokensInBlock.js"

const MAX_TOKENS_PER_SYNC = 50

export async function syncBrctokens(log: Logger) {
  log.info("Starting BRC token sync...")
  const lastSyncBlockHeight = (await database.syncStatus.findOne())?.brcSyncBlockHeight ?? null
  log.info(`Last synced block height: ${lastSyncBlockHeight?.toString() ?? 'none'}`)
  const currentBlockHeight = await getBestBrcBlockHeight()
  log.info(`Current block height: ${currentBlockHeight.toString()}`)

  if (lastSyncBlockHeight == null) {
    const tokenCount = await initialSync(log, currentBlockHeight)
    return { blocksSynced: 0, blocksSkippedOrFailed: 0, tokensUnsynced: 0, syncedTokens: tokenCount, failedToSync: 0 }
  }
  else {
    const { blocksSynced, blocksSkippedOrFailed, tokensUnsynced }
      = await syncBlocks(log, lastSyncBlockHeight, currentBlockHeight)
    const { syncedTokens, failedToSync } = await syncUnsyncedBrcTokens(log)
    return {
      blocksSynced,
      blocksSkippedOrFailed,
      tokensUnsynced,
      syncedTokens,
      failedToSync
    }
  }  
}

// Fetches tokens interacted with in new blocks. These are marked as unsynced, and the synced block height is updated.
async function syncBlocks(log: Logger, lastSyncHeight: number, currentHeight: number) {
  const tickers = new Set<string>()
  let syncedUpTo = lastSyncHeight
  for (let height = lastSyncHeight + 1; height <= currentHeight; height++) {
    try {
      log.info(`Syncing block height: ${height.toString()}`)
      const tickersThisBlock = await getInteractedBrcTokensInBlock(height)
      log.info(`Found ${tickersThisBlock.size} tokens in block height ${height.toString()}`)
      tickersThisBlock.forEach(ticker => tickers.add(ticker))
      syncedUpTo = height
    } catch (error) {
      log.warn(`Error syncing block height ${height.toString()}: ${error instanceof Error ? error.message : String(error)}. Saving current progress and skipping future blocks until next sync.`)
      break
    }
  }

  const syncedBlocks = syncedUpTo - lastSyncHeight
  if (syncedBlocks === 0 && tickers.size === 0) {
    log.info(`Did not sync any blocks or tokens.`)
    return { blocksSynced: 0, blocksSkippedOrFailed: 0, tokensUnsynced: 0 }
  }
  
  const unsyncedBlocks = currentHeight - syncedUpTo
  log.info(`Found ${tickers.size} unique tokens across ${syncedBlocks} synced blocks.`)
  log.info(`Skipped ${unsyncedBlocks} blocks due to errors.`)

  await database.withTransaction(async () => {
    await database.syncStatus.updateOne(
      {},
      { $set: { brcSyncBlockHeight: syncedUpTo } }
    )

    if (tickers.size === 0) return

    await database.brcToken.updateMany(
      { ticker: { $in: Array.from(tickers) } },
      { $set: { synced: false } },
      { upsert: true }
    )
  })

  return { blocksSynced: syncedBlocks, blocksSkippedOrFailed: unsyncedBlocks, tokensUnsynced: tickers.size }
}

async function syncUnsyncedBrcTokens(log: Logger) {
  const unsyncedTokens = await database.brcToken.find({ synced: false })
    .limit(MAX_TOKENS_PER_SYNC).toArray()

  if (unsyncedTokens.length === 0) {
    log.info(`No unsynced BRC tokens found`)
    return { syncedTokens: 0, failedToSync: 0 }
  }
  log.info(`Syncing ${unsyncedTokens.length} unsynced BRC tokens`)

  const tokens = await getBrcsByTicker(unsyncedTokens.map(t => t.ticker))
  const successfulTokens = tokens.filter(r => r.status === 'fulfilled').map(r => r.value)
  const failedTokens = tokens.filter(r => r.status === 'rejected').map(r => r.reason)

  if (failedTokens.length > 0) {
    log.warn(`Failed to fetch ${failedTokens.length} tokens`)
    for (const error of failedTokens) {
      log.warn(`Failed to fetch token with error: `, error)
    }
  }

  log.info(`Successfully fetched ${successfulTokens.length} tokens`)

  if (successfulTokens.length === 0) 
    return { syncedTokens: 0, failedToSync: unsyncedTokens.length }

  if (successfulTokens.length > 0) {
    await database.brcToken.bulkWrite(successfulTokens.map(token => ({
      updateOne: {
        filter: { ticker: token.ticker },
        update: { $set: { ...token, synced: true } },
        upsert: true
      }
    })))
  }

  return { syncedTokens: successfulTokens.length, failedToSync: tokens.length - successfulTokens.length }
}

async function initialSync(log: Logger, blockHeight: number) {
  log.info(`First sync. Performing initial sync.`)
  const tokens = await getAllBrcTokens()
  log.info(`Fetched ${tokens.length} BRC tokens.`)
  
  await database.withTransaction(async () => {
    await database.syncStatus.updateOne(
      {},
      { $set: { brcSyncBlockHeight: blockHeight } },
      { upsert: true }
    )

    if (tokens.length === 0) return

    await database.brcToken.bulkWrite(tokens.map(token => ({
      updateOne: {
        filter: { ticker: token.ticker },
        update: { $set: { ...token, synced: true } },
        upsert: true
      }
    })))
  })

  return tokens.length
}
