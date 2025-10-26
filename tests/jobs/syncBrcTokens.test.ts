import { WithId } from "mongodb"
import { MongoMemoryServer } from "mongodb-memory-server"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { BrcToken, SyncStatus } from "../../src/database/collections.js"
import { database } from "../../src/database/database.js"
import { syncBrctokens } from "../../src/jobs/syncBrcTokens.js"
import { DB_NAME } from "../../src/utils/constants.js"
import { mapBrcTokenToDbModel } from "../../src/utils/mapBrcTokenToDbModel.js"
import { getAllBrcTokens } from "../../src/utils/unisat/getAllBrcTokens.js"
import { getBestBrcBlockHeight } from "../../src/utils/unisat/getBestBrcBlockHeight.js"
import { getBrcByTicker, getBrcsByTicker } from "../../src/utils/unisat/getBrcByTicker.js"
import { getInteractedBrcTokensInBlock } from "../../src/utils/unisat/getInteractedBrcTokensInBlock.js"
import { MockLogger } from "../test-utils/MockLogger.js"
import Random from "../test-utils/Random.js"

vi.mock("../../src/utils/unisat/getBestBrcBlockHeight.js")
vi.mock("../../src/utils/unisat/getAllBrcTokens.js")
vi.mock("../../src/utils/unisat/getBrcByTicker.js")
vi.mock("../../src/utils/unisat/getInteractedBrcTokensInBlock.js")

let mongodb: MongoMemoryServer
beforeAll(async () => {
  mongodb = await MongoMemoryServer.create()
  await database.connect(mongodb.getUri(), DB_NAME)
})

afterAll(async () => {
  await database.disconnect()
  await mongodb.stop()
})

type BaseBrcToken = Awaited<ReturnType<typeof getBrcByTicker>>
function randomBrcTokenResponse(ticker?: string): BaseBrcToken {
  const max = Random.randomIntLessThan(1000000000)
  const minted = Random.randomIntLessThan(max).toString(10)
  return {
    ticker: ticker ?? Random.randomString({ length: 4, charset: 'alpha' }),
    selfMint: Random.randomBoolean(),
    holdersCount: Random.randomIntLessThan(1000),
    inscriptionNumber: Random.randomIntLessThan(10000000),
    inscriptionId: Random.randomInscriptionId(),
    max: max.toString(10),
    limit: Random.randomIntLessThan(max).toString(10),
    minted,
    totalMinted: minted,
    confirmedMinted: minted,
    confirmedMinted1h: minted,
    confirmedMinted24h: minted,
    mintTimes: Random.randomIntLessThan(100),
    decimal: Random.randRange(1, 19),
    deployHeight: 800000,
    deployBlocktime: new Date().getTime(),
    completeHeight: 0,
    completeBlocktime: 0,
    inscriptionNumberStart: 0,
    inscriptionNumberEnd: 0
  }
}

interface SetupArgs {
  syncStatus?: SyncStatus | null
  currentBlockHeight?: number
  dbBrcTokens?: BaseBrcToken[]
  currentBrcTokens?: BaseBrcToken[]
}

async function setup({ syncStatus = null, currentBlockHeight = 900000, dbBrcTokens, currentBrcTokens }: SetupArgs = {}) {
  await database.syncStatus.deleteMany()
  if (syncStatus != null) {
    await database.syncStatus.insertOne(syncStatus)
  }

  vi.mocked(getBestBrcBlockHeight).mockResolvedValue(currentBlockHeight)

  currentBrcTokens ??= Array.from({ length: 10 }, () => randomBrcTokenResponse())
  dbBrcTokens ??= currentBrcTokens.slice(0, 5).map(token => randomBrcTokenResponse(token.ticker))
  vi.mocked(getAllBrcTokens).mockResolvedValue(currentBrcTokens)
  mockBrcsByTicker(currentBrcTokens)

  if (dbBrcTokens.length > 0) {
    await database.brcToken.insertMany(dbBrcTokens.map(token => ({
      ticker: token.ticker,
      ...mapBrcTokenToDbModel(token, { synced: true, initialised: true })
    })))
  }

  return {
    currentBrcTokens,
    dbBrcTokens
  }
}

function mockBrcsByTicker(brcTokens: BaseBrcToken[], failedTickers: string[] = []) {
  vi.mocked(getBrcsByTicker).mockImplementation(tickers => Promise.resolve(tickers.map(ticker => {
    const token = brcTokens.find(token => token.ticker === ticker)
    if (failedTickers.includes(ticker) || token == null) {
      return { status: 'rejected', reason: new Error('Failed to fetch ticker') } as const
    }
    return { status: 'fulfilled', value: token } as const
  })))
}

describe('syncBrcTokens', () => {
  it('should do initial sync if no sync status exists', async () => {
    const { currentBrcTokens } = await setup({ syncStatus: null, currentBlockHeight: 900000, dbBrcTokens: [] })

    const result = await syncBrctokens(new MockLogger())

    expect(result).toEqual({
      blocksSynced: 0,
      blocksSkippedOrFailed: 0,
      tokensUnsynced: 0,
      syncedTokens: 10,
      failedToSync: 0
    })

    for (const token of currentBrcTokens) {
      const dbToken = await database.brcToken.findOne({ ticker: token.ticker })
      compareDbTokenData(dbToken, token)
      expect(dbToken?.initialised).toBe(true)
      expect(dbToken?.synced).toBe(true)
    }

    const syncStatus = await database.syncStatus.findOne({})
    expect(syncStatus?.brcSyncBlockHeight).toBe(900000)

    await database.brcToken.deleteMany({ ticker: { $in: currentBrcTokens.map(t => t.ticker) } })
  })

  it('should update existing tokens, and add new ones when syncing', async () => {
    const { currentBrcTokens } = await setup({ syncStatus: { brcSyncBlockHeight: 900000 }, currentBlockHeight: 900002 })
    
    vi.mocked(getInteractedBrcTokensInBlock)
      .mockResolvedValueOnce(new Set(currentBrcTokens.slice(0, 7).map(x => x.ticker)))
      .mockResolvedValueOnce(new Set(currentBrcTokens.slice(3).map(x => x.ticker)))

    const result = await syncBrctokens(new MockLogger())

    expect(result).toEqual({
      blocksSynced: 2,
      blocksSkippedOrFailed: 0,
      tokensUnsynced: 10,
      syncedTokens: 10,
      failedToSync: 0
    })

    const updatedSyncStatus = await database.syncStatus.findOne({})
    expect(updatedSyncStatus?.brcSyncBlockHeight).toBe(900002)

    expect(getInteractedBrcTokensInBlock).toHaveBeenCalledWith(900001)
    expect(getInteractedBrcTokensInBlock).toHaveBeenCalledWith(900002)
    expect(getBrcsByTicker).toHaveBeenCalledWith(currentBrcTokens.map(x => x.ticker))

    for (const token of currentBrcTokens) {
      const dbToken = await database.brcToken.findOne({ ticker: token.ticker })
      compareDbTokenData(dbToken, token)
      expect(dbToken?.initialised).toBe(true)
      expect(dbToken?.synced).toBe(true)
    }

    await database.brcToken.deleteMany({ ticker: { $in: currentBrcTokens.map(t => t.ticker) } })
  })

  it('should handle block sync errors gracefully', async () => {
    const { currentBrcTokens } = await setup({ syncStatus: { brcSyncBlockHeight: 900000 }, currentBlockHeight: 900003 })

    vi.mocked(getInteractedBrcTokensInBlock)
      .mockResolvedValueOnce(new Set(currentBrcTokens.slice(0, 1).map(x => x.ticker)))
      .mockRejectedValueOnce(new Error('Network error'))

    const result = await syncBrctokens(new MockLogger())

    expect(result).toEqual({
      blocksSynced: 1,
      blocksSkippedOrFailed: 2,
      tokensUnsynced: 1,
      syncedTokens: 1,
      failedToSync: 0
    })

    const updatedSyncStatus = await database.syncStatus.findOne({})
    expect(updatedSyncStatus?.brcSyncBlockHeight).toBe(900001)

    expect(getInteractedBrcTokensInBlock).toHaveBeenCalledTimes(2)
    expect(getInteractedBrcTokensInBlock).toHaveBeenCalledWith(900001)
    expect(getInteractedBrcTokensInBlock).toHaveBeenCalledWith(900002)

    await database.brcToken.deleteMany({ ticker: { $in: currentBrcTokens.map(t => t.ticker) } })
  })

  it('should handle no new blocks to sync', async () => {
    const { currentBrcTokens } = await setup({ syncStatus: { brcSyncBlockHeight: 900000 }, currentBlockHeight: 900000 })

    const result = await syncBrctokens(new MockLogger())

    expect(result).toEqual({
      blocksSynced: 0,
      blocksSkippedOrFailed: 0,
      tokensUnsynced: 0,
      syncedTokens: 0,
      failedToSync: 0
    })

    expect(getInteractedBrcTokensInBlock).not.toHaveBeenCalled()

    await database.brcToken.deleteMany({ ticker: { $in: currentBrcTokens.map(t => t.ticker) } })
  })

  it('should sync unsynced tokens with mixed success and failure', async () => {
    const { currentBrcTokens, dbBrcTokens } = await setup({ syncStatus: { brcSyncBlockHeight: 900000 }, currentBlockHeight: 900001 })

    const nonExistingTokens = currentBrcTokens.filter(token => !dbBrcTokens.some(dbToken => dbToken.ticker === token.ticker))
    const existingTokens = currentBrcTokens.filter(token => dbBrcTokens.some(dbToken => dbToken.ticker === token.ticker))
    const existingFail = Random.randomChoice(existingTokens)
    const existingSuccess = Random.randomChoice(existingTokens.filter(token => token.ticker !== existingFail.ticker))
    const nonExistingFail = Random.randomChoice(nonExistingTokens)
    const nonExistingSuccess = Random.randomChoice(nonExistingTokens.filter(token => token.ticker !== nonExistingFail.ticker))

    vi.mocked(getInteractedBrcTokensInBlock)
      .mockResolvedValue(new Set([existingFail.ticker, nonExistingSuccess.ticker, existingSuccess.ticker, nonExistingFail.ticker]))

    mockBrcsByTicker(currentBrcTokens, [existingFail.ticker, nonExistingFail.ticker])
    
    const result = await syncBrctokens(new MockLogger())

    expect(result).toEqual({
      blocksSynced: 1,
      blocksSkippedOrFailed: 0,
      tokensUnsynced: 4,
      syncedTokens: 2,
      failedToSync: 2
    })

    const existingFailFromDb = await database.brcToken.findOne({ ticker: existingFail.ticker })
    expect(existingFailFromDb?.synced).toBe(false)
    expect(existingFailFromDb?.initialised).toBe(true)

    const existingSuccessFromDb = await database.brcToken.findOne({ ticker: existingSuccess.ticker })
    expect(existingSuccessFromDb?.synced).toBe(true)
    expect(existingSuccessFromDb?.initialised).toBe(true)
    compareDbTokenData(existingSuccessFromDb, existingSuccess)

    const nonExistingFailFromDb = await database.brcToken.findOne({ ticker: nonExistingFail.ticker })
    expect(nonExistingFailFromDb?.synced).toBe(false)
    expect(nonExistingFailFromDb?.initialised).toBe(false)

    const nonExistingSuccessFromDb = await database.brcToken.findOne({ ticker: nonExistingSuccess.ticker })
    expect(nonExistingSuccessFromDb?.synced).toBe(true)
    expect(nonExistingSuccessFromDb?.initialised).toBe(true)
    compareDbTokenData(nonExistingSuccessFromDb, nonExistingSuccess)

    await database.brcToken.deleteMany({ ticker: { $in: currentBrcTokens.map(t => t.ticker) } })
  })

  it('should handle empty blocks with no token interactions', async () => {
    const { currentBrcTokens } = await setup({ syncStatus: { brcSyncBlockHeight: 900000 }, currentBlockHeight: 900002 })

    // Mock empty blocks
    vi.mocked(getInteractedBrcTokensInBlock)
      .mockResolvedValueOnce(new Set())
      .mockResolvedValueOnce(new Set())

    vi.mocked(getBrcsByTicker).mockResolvedValue([])

    const result = await syncBrctokens(new MockLogger())

    expect(result).toEqual({
      blocksSynced: 2,
      blocksSkippedOrFailed: 0,
      tokensUnsynced: 0,
      syncedTokens: 0,
      failedToSync: 0
    })

    const updatedSyncStatus = await database.syncStatus.findOne({})
    expect(updatedSyncStatus?.brcSyncBlockHeight).toBe(900002)

    await database.brcToken.deleteMany({ ticker: { $in: currentBrcTokens.map(t => t.ticker) } })
  })

  it('should handle no unsynced tokens', async () => {
    const { currentBrcTokens } = await setup({ syncStatus: { brcSyncBlockHeight: 900000 }, currentBlockHeight: 900000 })

    vi.mocked(getBrcsByTicker).mockResolvedValue([])

    const result = await syncBrctokens(new MockLogger())

    expect(result).toEqual({
      blocksSynced: 0,
      blocksSkippedOrFailed: 0,
      tokensUnsynced: 0,
      syncedTokens: 0,
      failedToSync: 0
    })

    expect(getBrcsByTicker).not.toHaveBeenCalled()

    await database.brcToken.deleteMany({ ticker: { $in: currentBrcTokens.map(t => t.ticker) } })
  })
})


function compareDbTokenData(dbToken: WithId<BrcToken> | null, token: Awaited<ReturnType<typeof getBrcByTicker>>) {
  expect(dbToken).toBeDefined()
  expect(dbToken?.selfMint).toBe(token.selfMint)
  expect(dbToken?.holdersCount).toBe(token.holdersCount)
  expect(dbToken?.inscriptionNumber).toBe(token.inscriptionNumber)
  expect(dbToken?.inscriptionId).toBe(token.inscriptionId)
  expect(dbToken?.max).toBe(token.max)
  expect(dbToken?.limit).toBe(token.limit)
  expect(dbToken?.minted).toBe(token.minted)
  expect(dbToken?.totalMinted).toBe(token.totalMinted)
  expect(dbToken?.confirmedMinted).toBe(token.confirmedMinted)
  expect(dbToken?.confirmedMinted1h).toBe(token.confirmedMinted1h)
  expect(dbToken?.confirmedMinted24h).toBe(token.confirmedMinted24h)
  expect(dbToken?.currentMintCount).toBe(token.mintTimes)
  expect(dbToken?.decimal).toBe(token.decimal)
  expect(dbToken?.deployHeight).toBe(token.deployHeight)
  expect(dbToken?.deployTimestamp).toBeInstanceOf(Date)
  expect(dbToken?.completeHeight).toBe(token.completeHeight)
  expect(dbToken?.completeBlocktime).toBe(token.completeBlocktime)
  expect(dbToken?.inscriptionNumberStart).toBe(token.inscriptionNumberStart)
  expect(dbToken?.inscriptionNumberEnd).toBe(token.inscriptionNumberEnd)
}
