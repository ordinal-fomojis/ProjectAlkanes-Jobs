import { BrcToken } from "../database/collections.js"
import { database } from "../database/database.js"
import { Logger } from "../utils/Logger.js"
import { mapBrcTokenToDbModel } from "../utils/mapBrcTokenToDbModel.js"
import { getAllBrcTokens } from "../utils/unisat/getAllBrcTokens.js"
import { getBestBrcBlockHeight } from "../utils/unisat/getBestBrcBlockHeight.js"
import { getBrcsByTicker } from "../utils/unisat/getBrcByTicker.js"
import { getInteractedBrcTokensInBlock } from "../utils/unisat/getInteractedBrcTokensInBlock.js"

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
  completeHeight: 0,
  completeBlocktime: 0,
  inscriptionNumberStart: 0,
  inscriptionNumberEnd: 0,
  mintable: false,
  mintedOut: false,
  percentageMinted: 0,
  currentMintCount: 0,
  deployTimestamp: new Date(0),
  tickerLength: 0
} satisfies Omit<BrcToken, 'ticker' | 'synced'>

// Hardcoded BRC-20 tokens data
const HARDCODED_BRC_TOKENS = [
  {
    ticker: "gamefi",
    selfMint: false,
    holdersCount: 115,
    inscriptionNumber: 105344735,
    inscriptionId: "312b2a1069cbf10d46cd1f27784347ca5625750ebe51b08c79f1c29dc4294dc6i0",
    max: "888888888",
    limit: "8888",
    minted: "32064240",
    totalMinted: "32064240",
    confirmedMinted: "32064240",
    confirmedMinted1h: "-181424",
    confirmedMinted24h: "-181424",
    mintTimes: 3607,
    decimal: 18,
    deployHeight: 912691,
    deployBlocktime: 1734652800, // Approximate timestamp for block 912691
    completeHeight: 0,
    completeBlocktime: 0,
    inscriptionNumberStart: 105344735,
    inscriptionNumberEnd: 105344735
  },
  {
    ticker: "gamble",
    selfMint: false,
    holdersCount: 9,
    inscriptionNumber: 105344736,
    inscriptionId: "e425ad4ffe22d8c1c44bf1c85618cb442da84c8afc0fe87967f87e1638220192i0",
    max: "4206942069",
    limit: "9999",
    minted: "5359464",
    totalMinted: "5359464",
    confirmedMinted: "5359464",
    confirmedMinted1h: "0",
    confirmedMinted24h: "0",
    mintTimes: 536,
    decimal: 18,
    deployHeight: 912691,
    deployBlocktime: 1734652800, // Approximate timestamp for block 912691
    completeHeight: 0,
    completeBlocktime: 0,
    inscriptionNumberStart: 105344736,
    inscriptionNumberEnd: 105344736
  }
]

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

async function syncUnsyncedBrcTokens(log: Logger) {
  const unsyncedTokens = await database.brcToken.find({ synced: false })
    .limit(MAX_TOKENS_PER_SYNC).toArray()

  if (unsyncedTokens.length === 0) {
    log.info(`No unsynced BRC tokens found`)
    return { syncedTokens: 0, failedToSync: 0 }
  }
  log.info(`Syncing ${unsyncedTokens.length} unsynced BRC tokens`)

  // Separate hardcoded tokens from those that need API calls
  const hardcodedTickers = new Set(HARDCODED_BRC_TOKENS.map(t => t.ticker))
  const hardcodedTokensToSync = unsyncedTokens.filter((t: BrcToken) => hardcodedTickers.has(t.ticker))
  const apiTokensToSync = unsyncedTokens.filter((t: BrcToken) => !hardcodedTickers.has(t.ticker))

  // Get hardcoded token data
  const hardcodedTokensData = hardcodedTokensToSync.map((unsyncedToken: BrcToken) => {
    const hardcodedData = HARDCODED_BRC_TOKENS.find((t: typeof HARDCODED_BRC_TOKENS[0]) => t.ticker === unsyncedToken.ticker)
    if (!hardcodedData) {
      throw new Error(`Hardcoded token data not found for ticker: ${unsyncedToken.ticker}`)
    }
    return hardcodedData
  })

  // Get API token data
  const apiTokenResults = apiTokensToSync.length > 0 
    ? await getBrcsByTicker(apiTokensToSync.map((t: BrcToken) => t.ticker))
    : []

  const successfulApiTokens = apiTokenResults.filter(r => r.status === 'fulfilled').map(r => r.value)
  const failedApiTokens = apiTokenResults.filter(r => r.status === 'rejected').map(r => r.reason)

  // Combine hardcoded and API tokens
  const allSuccessfulTokens = [...hardcodedTokensData, ...successfulApiTokens]

  if (failedApiTokens.length > 0) {
    log.warn(`Failed to fetch ${failedApiTokens.length} tokens from API`)
    for (const error of failedApiTokens) {
      log.warn(`Failed to fetch token with error: `, error)
    }
  }

  if (hardcodedTokensData.length > 0) {
    log.info(`Using hardcoded data for ${hardcodedTokensData.length} tokens: ${hardcodedTokensData.map((t: typeof HARDCODED_BRC_TOKENS[0]) => t.ticker).join(', ')}`)
  }

  log.info(`Successfully fetched ${allSuccessfulTokens.length} tokens (${hardcodedTokensData.length} hardcoded, ${successfulApiTokens.length} from API)`)

  if (allSuccessfulTokens.length === 0) 
    return { syncedTokens: 0, failedToSync: unsyncedTokens.length }

  await database.brcToken.bulkWrite(allSuccessfulTokens.map(token => {
    return {
      updateOne: {
        filter: { ticker: token.ticker },
        update: { $set: mapBrcTokenToDbModel(token, { synced: true, initialised: true }) }
      }
    }
  }))

  return { syncedTokens: allSuccessfulTokens.length, failedToSync: apiTokenResults.length - successfulApiTokens.length }
}

async function initialSync(log: Logger, blockHeight: number) {
  log.info(`First sync. Performing initial sync.`)
  const apiTokens = await getAllBrcTokens()
  log.info(`Fetched ${apiTokens.length} BRC tokens from API.`)
  
  // Combine API tokens with hardcoded tokens
  const allTokens = [...apiTokens, ...HARDCODED_BRC_TOKENS]
  log.info(`Total tokens including hardcoded: ${allTokens.length} (${apiTokens.length} from API, ${HARDCODED_BRC_TOKENS.length} hardcoded)`)
  
  await database.withTransaction(async () => {
    await database.syncStatus.updateOne(
      {},
      { $set: { brcSyncBlockHeight: blockHeight } },
      { upsert: true }
    )

    if (allTokens.length === 0) return

    await database.brcToken.bulkWrite(allTokens.map(token => {
      return {
        updateOne: {
          filter: { ticker: token.ticker },
          update: { $set: mapBrcTokenToDbModel(token, { synced: true, initialised: true }) },
          upsert: true
        }
      }
    }))
  })

  return allTokens.length
}
