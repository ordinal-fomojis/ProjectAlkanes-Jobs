import { AlkaneTokenV2 } from "../database/collections.js"
import { database } from "../database/database.js"
import { getInteractedAlkaneTokensInBlock } from "../utils/getInteractedAlkaneTokensInBlock.js"
import { Logger } from "../utils/Logger.js"
import { mapAlkaneTokenToDbModel } from "../utils/mapAlkaneTokenToDbModel.js"
import { createRateLimitContext, RateLimitContext } from "../utils/rateLimit.js"
import { getBlockHeight } from "../utils/rpc/getBlockHeight.js"
import { getAlkanesByIds } from "../utils/unisat/getAlkaneById.js"
import { getAllAlkaneTokens } from "../utils/unisat/getAllAlkaneTokens.js"
import { getBestAlkaneBlockHeight } from "../utils/unisat/getBestAlkaneBlockHeight.js"
import { UnisatRateLimitOptions } from "../utils/unisat/unisatFetch.js"

const MAX_TOKENS_PER_SYNC = 50

const DEFAULT_ALKANE_TOKEN = {
  name: "",
  symbol: "",
  logoUrl: "",
  preminedSupply: "0",
  amountPerMint: "0",
  mintCountCap: "0",
  approximateMintCountCap: 0,
  currentSupply: "0",
  currentMintCount: 0,
  deployTxid: "",
  deployTimestamp: new Date(0),
  initialised: false,
  percentageMinted: 0,
  maxSupply: "0",
  mintedOut: false,
  preminedPercentage: 0,
  hasPremine: false,
  mintable: false,
  holdersCount: 0,
  pendingMints: 0
} satisfies Omit<AlkaneTokenV2, 'alkaneId' | 'synced'>

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
  } else {
    const { blocksSynced, blocksSkippedOrFailed, tokensUnsynced }
      = await syncBlocks(log, lastSyncBlockHeight, currentBlockHeight)
    const { syncedTokens, failedToSync } = await syncUnsyncedAlkaneTokens(log, rateLimitContext)
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
  const ids = new Set<string>()
  let syncedUpTo = lastSyncHeight
  for (let height = lastSyncHeight + 1; height <= currentHeight; height++) {
    try {
      log.info(`Syncing block height: ${height.toString()}`)
      const idsInBlock = await getInteractedAlkaneTokensInBlock(height)
      log.info(`Found ${idsInBlock.size} tokens in block height ${height.toString()}`)
      idsInBlock.forEach(id => ids.add(id))
      syncedUpTo = height
    } catch (error) {
      log.warn(`Error syncing block height ${height.toString()}: ${error instanceof Error ? error.message : String(error)}. Saving current progress and skipping future blocks until next sync.`)
      break
    }
  }

  const syncedBlocks = syncedUpTo - lastSyncHeight
  if (syncedBlocks === 0 && ids.size === 0) {
    log.info(`Did not sync any blocks or tokens.`)
    return { blocksSynced: 0, blocksSkippedOrFailed: 0, tokensUnsynced: 0 }
  }
  
  const unsyncedBlocks = currentHeight - syncedUpTo
  log.info(`Found ${ids.size} unique tokens across ${syncedBlocks} synced blocks.`)
  if (unsyncedBlocks > 0)
    log.info(`Skipped ${unsyncedBlocks} blocks due to errors.`)

  await database.withTransaction(async () => {
    await database.syncStatus.updateOne(
      {},
      { $set: { alkaneSyncBlockHeight: syncedUpTo } }
    )

    if (ids.size === 0) return

    await database.alkaneTokenV2.bulkWrite(Array.from(ids).map(alkaneId => ({
      updateOne: {
        filter: { alkaneId },
        update: {
          $set: { synced: false },
          $setOnInsert: DEFAULT_ALKANE_TOKEN satisfies Omit<AlkaneTokenV2, 'alkaneId' | 'synced'>
        },
        upsert: true
      }
    })))
  })

  return { blocksSynced: syncedBlocks, blocksSkippedOrFailed: unsyncedBlocks, tokensUnsynced: ids.size }
}

async function syncUnsyncedAlkaneTokens(log: Logger, rateLimitContext: RateLimitContext) {
  const unsyncedTokens = await database.alkaneTokenV2.find({ synced: false })
    .limit(MAX_TOKENS_PER_SYNC).toArray()

  if (unsyncedTokens.length === 0) {
    log.info(`No unsynced Alkane tokens tokens found`)
    return { syncedTokens: 0, failedToSync: 0 }
  }
  log.info(`Syncing ${unsyncedTokens.length} unsynced Alkane tokens`)

  const tokens = await getAlkanesByIds(unsyncedTokens.map(t => t.alkaneId), rateLimitContext)
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

  await database.alkaneTokenV2.bulkWrite(successfulTokens.map(token => {
    return {
      updateOne: {
        filter: { alkaneId: token.alkaneid },
        update: { $set: mapAlkaneTokenToDbModel(token, { synced: true, initialised: true }) }
      }
    }
  }))

  return { syncedTokens: successfulTokens.length, failedToSync: tokens.length - successfulTokens.length }
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
