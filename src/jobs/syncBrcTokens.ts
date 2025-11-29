import { BrcToken } from "../database/collections.js"
import { database } from "../database/database.js"
import { BrcType } from "../utils/constants.js"
import { Logger } from "../utils/Logger.js"
import { mapBrcTokenToDbModel } from "../utils/mapBrcTokenToDbModel.js"
import { populateBrcTimestamp } from "../utils/populateBrcTimestamp.js"
import { createRateLimitContext, RateLimitContext } from "../utils/rateLimit.js"
import { getBlockHeight } from "../utils/rpc/getBlockHeight.js"
import { getAllBrcTokens } from "../utils/unisat/getAllBrcTokens.js"
import { getBestBrcBlockHeight } from "../utils/unisat/getBestBrcBlockHeight.js"
import { getBrcsByTicker } from "../utils/unisat/getBrcByTicker.js"
import { getInteractedBrcTokensInBlock } from "../utils/unisat/getInteractedBrcTokensInBlock.js"
import { UnisatRateLimitOptions } from "../utils/unisat/unisatFetch.js"

const MAX_TOKENS_PER_SYNC = 50

const DEFAULT_BRC_TOKEN = {
  initialised: false,
  selfMint: false,
  holdersCount: 0,
  inscriptionNumber: 0,
  inscriptionId: "",
  max: "0",
  limit: "0",
  minted: "0",
  totalMinted: "0",
  confirmedMinted: "0",
  confirmedMinted1h: "0",
  confirmedMinted24h: "0",
  decimal: 0,
  deployHeight: 0,
  mintable: false,
  mintedOut: false,
  percentageMinted: 0,
  currentMintCount: 0,
  deployTimestamp: new Date(0),
  tickerLength: 0
} satisfies Omit<BrcToken, 'ticker' | 'synced'>

export async function syncBrcTokens(log: Logger, type: BrcType) {
  log.info(`Starting BRC token sync for type: ${type}...`)
  const rateLimitContext = createRateLimitContext(UnisatRateLimitOptions)

  const syncStatus = await database.syncStatus.findOne()
  const lastSyncBlockHeight = (type === BrcType.Default
    ? syncStatus?.brcSyncBlockHeight
    : syncStatus?.brcProgSyncBlockHeight
  ) ?? null

  log.info(`Last synced block height: ${lastSyncBlockHeight?.toString() ?? 'none'}`)

  const currentBlockHeight = await getBlockHeightToSyncTo(lastSyncBlockHeight, type, rateLimitContext)
  log.info(`Current block height: ${currentBlockHeight.toString()}`)

  if (lastSyncBlockHeight == null) {
    const tokenCount = await initialSync(log, type, currentBlockHeight, rateLimitContext)
    return { blocksSynced: 0, blocksSkippedOrFailed: 0, tokensUnsynced: 0, syncedTokens: tokenCount, failedToSync: 0 }
  } else {
    const { blocksSynced, blocksSkippedOrFailed, tokensUnsynced }
      = await syncBlocks(log, type, lastSyncBlockHeight, currentBlockHeight, rateLimitContext)
    const { syncedTokens, failedToSync } = await syncUnsyncedBrcTokens(log, rateLimitContext)
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
async function syncBlocks(log: Logger, type: BrcType, lastSyncHeight: number, currentHeight: number, rateLimitContext: RateLimitContext) {
  const tickers = new Set<string>()
  let syncedUpTo = lastSyncHeight
  for (let height = lastSyncHeight + 1; height <= currentHeight; height++) {
    try {
      log.info(`Syncing block height: ${height.toString()}`)
      const tickersThisBlock = await getInteractedBrcTokensInBlock(type, height, rateLimitContext)
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

  const syncStatusUpdate = type === BrcType.Default
    ? { brcSyncBlockHeight: syncedUpTo }
    : { brcProgSyncBlockHeight: syncedUpTo }

  await database.withTransaction(async () => {
    await database.syncStatus.updateOne(
      {},
      { $set: syncStatusUpdate }
    )

    if (tickers.size === 0) return

    await database.brcToken.bulkWrite(Array.from(tickers).map(ticker => ({
      updateOne: {
        filter: { ticker },
        update: {
          $set: { synced: false },
          $setOnInsert: DEFAULT_BRC_TOKEN satisfies Omit<BrcToken, 'ticker' | 'synced'>
        },
        upsert: true
      }
    })))
  })

  return { blocksSynced: syncedBlocks, blocksSkippedOrFailed: unsyncedBlocks, tokensUnsynced: tickers.size }
}

async function syncUnsyncedBrcTokens(log: Logger, rateLimitContext: RateLimitContext) {
  const unsyncedTokens = await database.brcToken.find({ synced: false })
    .limit(MAX_TOKENS_PER_SYNC).toArray()

  if (unsyncedTokens.length === 0) {
    log.info(`No unsynced BRC tokens found`)
    return { syncedTokens: 0, failedToSync: 0 }
  }
  log.info(`Syncing ${unsyncedTokens.length} unsynced BRC tokens`)

  const tokens = await getBrcsByTicker(unsyncedTokens.map(t => t.ticker), rateLimitContext)
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

  const tokensWithTimestamps = await populateBrcTimestamp(successfulTokens, unsyncedTokens)

  log.info(`Saving ${tokensWithTimestamps.length} tickers to the database`)
  await database.brcToken.bulkWrite(tokensWithTimestamps.map(token => {
    return {
      updateOne: {
        filter: { ticker: token.ticker },
        update: { $set: mapBrcTokenToDbModel(token, { synced: true, initialised: true }) }
      }
    }
  }))

  return { syncedTokens: successfulTokens.length, failedToSync: tokens.length - successfulTokens.length }
}

async function initialSync(log: Logger, type: BrcType, blockHeight: number, rateLimitContext: RateLimitContext) {
  log.info(`First sync. Performing initial sync.`)
  const tokens = await populateBrcTimestamp(await getAllBrcTokens(type, rateLimitContext), [])
  log.info(`Fetched ${tokens.length} BRC tokens.`)

  const syncStatusUpdate = type === BrcType.Default
    ? { brcSyncBlockHeight: blockHeight }
    : { brcProgSyncBlockHeight: blockHeight }

  await database.withTransaction(async () => {
    await database.syncStatus.updateOne(
      {},
      { $set: syncStatusUpdate },
      { upsert: true }
    )

    if (tokens.length === 0) return

    await database.brcToken.bulkWrite(tokens.map(token => {
      return {
        updateOne: {
          filter: { ticker: token.ticker },
          update: { $set: mapBrcTokenToDbModel(token, { synced: true, initialised: true }) },
          upsert: true
        }
      }
    }))
  })

  return tokens.length
}

async function getBlockHeightToSyncTo(lastSyncedBlockHeight: number | null, type: BrcType, rateLimitContext: RateLimitContext) {
  const actualBlockHeight = await getBlockHeight()

  // If we have synced up to the actual block height, then it's not possible for there to be unsynced blocks,
  // so just return the height we've synced to.
  if (lastSyncedBlockHeight != null && lastSyncedBlockHeight >= actualBlockHeight) {
    return actualBlockHeight
  }

  return await getBestBrcBlockHeight(type, rateLimitContext)
}
