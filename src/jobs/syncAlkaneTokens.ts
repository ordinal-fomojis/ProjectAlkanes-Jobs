import { BlockHeight } from "../database/collections.js"
import { database } from "../database/database.js"
import { syncCalculatedFields } from "../database/syncCalculatedFields.js"
import { decodeAlkaneOpCallsInBlock } from "../utils/decoder.js"
import { Logger } from "../utils/Logger.js"
import { getAlkaneIdsAfterTimestamp, getAlkaneTokens } from "../utils/ordiscan/getAlkanes.js"
import { getBlockHeight } from "../utils/rpc/getBlockHeight.js"
import { getBlockTimestamp } from "../utils/rpc/getBlockTimestamp.js"
import { getRawBlocks } from "../utils/rpc/getRawBlocks.js"

const MAX_TOKENS_PER_SYNC = 50
const MAX_BLOCKS_PER_BATCH = 3

export async function syncAlkaneTokens(log: Logger) {
  log.info("Starting Alkane token sync...")
  const lastSyncBlockHeight = await database.blockHeight.find().sort({ height: 'desc' }).limit(1).next()
  log.info(`Last synced block height: ${(lastSyncBlockHeight?.height)?.toString() ?? 'none'}`)
  const currentBlockHeight = await getBlockHeight()
  log.info(`Current block height: ${currentBlockHeight.toString()}`)
  
  const { blocksSynced, tokensUnsynced } = await syncBlocks(log, lastSyncBlockHeight?.height ?? null, currentBlockHeight)
  const { tokensFetched } = await fetchNewTokens(log, lastSyncBlockHeight, currentBlockHeight)
  const { syncedTokens, failedToSync } = await syncUnsyncedAlkaneTokens(log, currentBlockHeight)

  if (lastSyncBlockHeight == null) {
    log.info(`First sync. Inserting block height: ${currentBlockHeight.toString()}`)
    await database.blockHeight.insertOne({
      height: currentBlockHeight,
      synced: true,
      timestamp: await getBlockTimestamp(currentBlockHeight)
    })
  }

  return {
    blocksSynced,
    tokensInBlocks: tokensUnsynced,
    newTokens: tokensFetched,
    syncedTokens,
    failedToSync
  }
}

// Fetches unsynced blocks. Each block successfully fetched and decoded is marked as synced,
// and any tokens interacted with in the block are unsynced.
async function syncBlocks(log: Logger, lastSyncHeight: number | null, currentHeight: number) {
  // Unsynced blocks are all those since the last sync, and any marked as unsynced in the database
  const blocksSinceLastSync = lastSyncHeight == null ? []
    : Array.from({ length: currentHeight - lastSyncHeight }, (_, i) => i + lastSyncHeight + 1)
  const unsyncedBlocks = (await database.blockHeight.find({ synced: false }).toArray())
    .map(b => b.height).concat(blocksSinceLastSync).slice(0, MAX_BLOCKS_PER_BATCH)

  if (unsyncedBlocks.length === 0) return { blocksSynced: 0, tokensUnsynced: 0 }

  let unsyncedTokenCount = 0
  for (let i = 0; i < unsyncedBlocks.length; i += MAX_BLOCKS_PER_BATCH) {
    const blockResponses = await getRawBlocks(unsyncedBlocks.slice(i, i + MAX_BLOCKS_PER_BATCH))
    const tokenIds = new Set(blockResponses.filter(b => b.success)
      .flatMap(b => decodeAlkaneOpCallsInBlock(b.response))
      .flatMap(b => b.opcalls.map(o => o.alkaneId)))
    
    await database.withTransaction(async () => {    
      await database.blockHeight.bulkWrite(blockResponses.map(b => ({
        updateOne: {
          filter: { height: b.height },
          update: { $set: {
            height: b.height,
            timestamp: b.success ? new Date(b.response.timestamp * 1000) : new Date(0),
            synced: b.success
          } },
          upsert: true
        }
      })))

      await database.alkaneToken.updateMany(
        { alkaneId: { $in: Array.from(tokenIds) } },
        { $set: { synced: false } }
      )
    })
    log.info(`Synced ${blockResponses.length.toString()} blocks`)
    log.info(`Unsynced ${tokenIds.size.toString()} tokens`)
    unsyncedTokenCount += tokenIds.size
  }

  return { blocksSynced: unsyncedBlocks.length, tokensUnsynced: unsyncedTokenCount }
}

// Fetch list of alkanes after the given timestamp, or all if no timestamp is provided,
// and save them to the database as unsynced tokens.
async function fetchNewTokens(log: Logger, lastSyncedBlock: BlockHeight | null, currentBlockHeight: number) {
  if (lastSyncedBlock?.height === currentBlockHeight) return { tokensFetched: 0 }

  const alkanes = await getAlkaneIdsAfterTimestamp(lastSyncedBlock?.timestamp ?? null)
  if (alkanes.length === 0) return { tokensFetched: 0 }

  await database.alkaneToken.bulkWrite(alkanes.map(token => ({
    updateOne: {
      filter: { alkaneId: token.alkaneId },
      update: { $setOnInsert: {
        ...token,
        synced: false,
        blockSyncedAt: 0
      } },
      upsert: true
    }
  })))

  await syncCalculatedFields({ alkaneId: { $in: alkanes.map(x => x.alkaneId) } }, { syncPendingMints: true })
  log.info(`Fetched and saved ${alkanes.length} new tokens`)
  return { tokensFetched: alkanes.length }
}

// Syncs all tokens marked as unsynced in the database.
async function syncUnsyncedAlkaneTokens(log: Logger, currentBlockHeight: number) {
  const unsyncedTokens = await database.alkaneToken.find({ synced: false })
    .sort({ blockSyncedAt: 'asc' })
    .limit(MAX_TOKENS_PER_SYNC).toArray()
  log.info(`Syncing ${unsyncedTokens.length} tokens`)

  const tokens = await getAlkaneTokens(unsyncedTokens, currentBlockHeight)
  const successfulTokens = tokens.filter(r => r.status === 'fulfilled').map(r => r.value)
  log.info(`Successfully fetched ${successfulTokens.length} tokens`)

  const failedTokens = tokens.filter(r => r.status === 'rejected').map(r => r.reason)
  if (failedTokens.length > 0) {
    log.warn(`Failed to fetch ${failedTokens.length} tokens`)
    for (const error of failedTokens) {
      log.warn(`Failed to fetch token with error: `, error)
    }
  }
  
  if (successfulTokens.length === 0) return { syncedTokens: 0, failedToSync: unsyncedTokens.length }

  await database.alkaneToken.bulkWrite(successfulTokens.map(token => ({
    updateOne: {
      filter: { alkaneId: token.alkaneId },
      update: { $set: token },
      upsert: true
    }
  })))
  
  await syncCalculatedFields({ alkaneId: { $in: successfulTokens.map(x => x.alkaneId) } }, { syncMintable: true })

  return { syncedTokens: successfulTokens.length, failedToSync: tokens.length - successfulTokens.length }
}
