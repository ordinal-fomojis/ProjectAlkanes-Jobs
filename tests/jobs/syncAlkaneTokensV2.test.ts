import { WithId } from "mongodb"
import { MongoMemoryServer } from "mongodb-memory-server"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { AlkaneTokenV2 } from "../../src/database/collections.js"
import { database } from "../../src/database/database.js"
import { syncAlkaneTokensV2 } from "../../src/jobs/syncAlkaneTokensV2.js"
import { DB_NAME } from "../../src/utils/constants.js"
import { getInteractedAlkaneTokensInBlock } from "../../src/utils/getInteractedAlkaneTokensInBlock.js"
import { mapAlkaneTokenToDbModel } from "../../src/utils/mapAlkaneTokenToDbModel.js"
import { getBlockHeight } from "../../src/utils/rpc/getBlockHeight.js"
import { getAlkanesByIds, UnisatAlkaneToken } from "../../src/utils/unisat/getAlkaneById.js"
import { getAllAlkaneTokens } from "../../src/utils/unisat/getAllAlkaneTokens.js"
import { getBestAlkaneBlockHeight } from "../../src/utils/unisat/getBestAlkaneBlockHeight.js"
import { MockLogger } from "../test-utils/MockLogger.js"
import Random from "../test-utils/Random.js"

vi.mock("../../src/utils/rpc/getBlockHeight.js")
vi.mock("../../src/utils/unisat/getBestAlkaneBlockHeight.js")
vi.mock("../../src/utils/unisat/getAllAlkaneTokens.js")
vi.mock("../../src/utils/unisat/getAlkaneById.js")
vi.mock("../../src/utils/getInteractedAlkaneTokensInBlock.js")

let mongodb: MongoMemoryServer
beforeAll(async () => {
  mongodb = await MongoMemoryServer.create()
  await database.connect(mongodb.getUri(), DB_NAME)
})

beforeEach(async () => {
  await database.alkaneTokenV2.deleteMany({})
  await database.syncStatus.deleteMany()
})

afterAll(async () => {
  await database.disconnect()
  await mongodb.stop()
})

function randomAlkaneTokenResponse(id?: string): UnisatAlkaneToken {
  const max = Random.randomIntLessThan(1000000000)
  const minted = Random.randomIntLessThan(max).toString(10)
  return {
    alkaneid: id ?? `2:${Random.randomIntLessThan(10000)}`,
    height: 800000,
    txid: Random.randomTransactionId(),
    timestamp: new Date().getTime(),
    logo: `https://example.com/logo/${Random.randomIntLessThan(1000)}.png`,
    type: "token",
    tokenData: {
      name: `AlkaneToken${Random.randomIntLessThan(1000)}`,
      symbol: `ATK${Random.randomIntLessThan(1000)}`,
      divisibility: 8,
      totalSupply: max.toString(10),
      maxSupply: max.toString(10),
      premine: Random.randomIntLessThan(max).toString(10),
      perMint: Random.randomIntLessThan(100000).toString(10),
      minted: parseInt(minted, 10),
      cap: Random.randomIntLessThan(10000),
      mintable: Random.randomBoolean(),
      holders: Random.randomIntLessThan(1000)
    }
  }
}

interface SetupArgs {
  lastSyncedHeight?: number | null
  currentBlockHeight?: number
  dbAlkaneTokens?: UnisatAlkaneToken[]
  currentAlkaneTokens?: UnisatAlkaneToken[]
}

async function setup({ lastSyncedHeight = null, currentBlockHeight = 900000, dbAlkaneTokens, currentAlkaneTokens }: SetupArgs = {}) {
  await database.syncStatus.deleteMany()
  if (lastSyncedHeight != null) {
    await database.syncStatus.insertOne({ alkaneSyncBlockHeight: lastSyncedHeight })
  }

  vi.mocked(getBlockHeight).mockResolvedValue(currentBlockHeight)
  vi.mocked(getBestAlkaneBlockHeight).mockResolvedValue(currentBlockHeight)

  currentAlkaneTokens ??= Array.from({ length: 10 }, () => randomAlkaneTokenResponse())
  dbAlkaneTokens ??= currentAlkaneTokens.slice(0, 5).map(token => randomAlkaneTokenResponse(token.alkaneid))
  vi.mocked(getAllAlkaneTokens).mockResolvedValue(currentAlkaneTokens)
  mockAlkanesById(currentAlkaneTokens)

  if (dbAlkaneTokens.length > 0) {
    await database.alkaneTokenV2.insertMany(dbAlkaneTokens.map(token => ({
      alkaneId: token.alkaneid, pendingMints: 0,
      ...mapAlkaneTokenToDbModel(token, { synced: true, initialised: true })
    })))
  }

  return {
    currentAlkaneTokens,
    dbAlkaneTokens
  }
}

function mockAlkanesById(alkaneTokens: UnisatAlkaneToken[], failedIds: string[] = []) {
  vi.mocked(getAlkanesByIds).mockImplementation(ids => Promise.resolve(ids.map(id => {
    const token = alkaneTokens.find(token => token.alkaneid === id)
    if (failedIds.includes(id) || token == null) {
      return { status: 'rejected', reason: new Error('Failed to fetch id') } as const
    }
    return { status: 'fulfilled', value: token } as const
  })))
}

describe('syncAlkaneTokens', () => {
  it('should do initial sync if no sync status exists', async () => {
    const { currentAlkaneTokens } = await setup({ currentBlockHeight: 900000, dbAlkaneTokens: [] })

    const result = await syncAlkaneTokensV2(new MockLogger())

    expect(result).toEqual({
      blocksSynced: 0,
      blocksSkippedOrFailed: 0,
      alkanesUnsynced: 0,
      syncedAlkanes: 10,
      failedToSync: 0
    })

    for (const token of currentAlkaneTokens) {
      const dbToken = await database.alkaneTokenV2.findOne({ alkaneId: token.alkaneid })
      compareDbTokenData(dbToken, token)
      expect(dbToken?.initialised).toBe(true)
      expect(dbToken?.synced).toBe(true)
    }

    const syncHeight = (await database.syncStatus.findOne({}))?.alkaneSyncBlockHeight
    expect(syncHeight).toBe(900000)
  })

  it('should update existing tokens, and add new ones when syncing', async () => {
    const { currentAlkaneTokens } = await setup({
      lastSyncedHeight: 900000,
      currentBlockHeight: 900002
    })
    
    vi.mocked(getInteractedAlkaneTokensInBlock)
      .mockResolvedValueOnce(new Set(currentAlkaneTokens.slice(0, 7).map(x => x.alkaneid)))
      .mockResolvedValueOnce(new Set(currentAlkaneTokens.slice(3).map(x => x.alkaneid)))

    const result = await syncAlkaneTokensV2(new MockLogger())

    expect(result).toEqual({
      blocksSynced: 2,
      blocksSkippedOrFailed: 0,
      alkanesUnsynced: 10,
      syncedAlkanes: 10,
      failedToSync: 0
    })

    const syncHeight = (await database.syncStatus.findOne({}))?.alkaneSyncBlockHeight
    expect(syncHeight).toBe(900002)

    expect(getInteractedAlkaneTokensInBlock).toHaveBeenCalledTimes(2)
    expect(getInteractedAlkaneTokensInBlock).toHaveBeenCalledWith(900001)
    expect(getInteractedAlkaneTokensInBlock).toHaveBeenCalledWith(900002)

    expect(getAlkanesByIds).toHaveBeenCalledOnce()
    expect(getAlkanesByIds).toHaveBeenCalledWith(currentAlkaneTokens.map(x => x.alkaneid), expect.any(Object))

    for (const token of currentAlkaneTokens) {
      const dbToken = await database.alkaneTokenV2.findOne({ alkaneId: token.alkaneid })
      compareDbTokenData(dbToken, token)
      expect(dbToken?.initialised).toBe(true)
      expect(dbToken?.synced).toBe(true)
    }
  })

  it('should handle block sync errors gracefully', async () => {
    const { currentAlkaneTokens } = await setup({
      lastSyncedHeight: 900000,
      currentBlockHeight: 900003
    })

    vi.mocked(getInteractedAlkaneTokensInBlock)
      .mockResolvedValueOnce(new Set(currentAlkaneTokens.slice(0, 1).map(x => x.alkaneid)))
      .mockRejectedValueOnce(new Error('Network error'))

    const result = await syncAlkaneTokensV2(new MockLogger())

    expect(result).toEqual({
      blocksSynced: 1,
      blocksSkippedOrFailed: 2,
      alkanesUnsynced: 1,
      syncedAlkanes: 1,
      failedToSync: 0
    })

    const syncHeight = (await database.syncStatus.findOne({}))?.alkaneSyncBlockHeight
    expect(syncHeight).toBe(900001)

    expect(getInteractedAlkaneTokensInBlock).toHaveBeenCalledTimes(2)
    expect(getInteractedAlkaneTokensInBlock).toHaveBeenCalledWith(900001)
    expect(getInteractedAlkaneTokensInBlock).toHaveBeenCalledWith(900002)
  })

  it('should handle no new blocks to sync', async () => {
    await setup({
      lastSyncedHeight: 900000,
      currentBlockHeight: 900000
    })

    const result = await syncAlkaneTokensV2(new MockLogger())

    expect(result).toEqual({
      blocksSynced: 0,
      blocksSkippedOrFailed: 0,
      alkanesUnsynced: 0,
      syncedAlkanes: 0,
      failedToSync: 0
    })

    expect(getInteractedAlkaneTokensInBlock).not.toHaveBeenCalled()
  })

  it('should sync unsynced tokens with mixed success and failure', async () => {
    const { currentAlkaneTokens, dbAlkaneTokens } = await setup({
      lastSyncedHeight: 900000,
      currentBlockHeight: 900001
    })

    const nonExistingTokens = currentAlkaneTokens.filter(token => !dbAlkaneTokens.some(dbToken => dbToken.alkaneid === token.alkaneid))
    const existingTokens = currentAlkaneTokens.filter(token => dbAlkaneTokens.some(dbToken => dbToken.alkaneid === token.alkaneid))
    const existingFail = Random.randomChoice(existingTokens)
    const existingSuccess = Random.randomChoice(existingTokens.filter(token => token.alkaneid !== existingFail.alkaneid))
    const nonExistingFail = Random.randomChoice(nonExistingTokens)
    const nonExistingSuccess = Random.randomChoice(nonExistingTokens.filter(token => token.alkaneid !== nonExistingFail.alkaneid))

    vi.mocked(getInteractedAlkaneTokensInBlock)
          .mockResolvedValue(new Set([existingFail.alkaneid, nonExistingSuccess.alkaneid, existingSuccess.alkaneid, nonExistingFail.alkaneid]))

    mockAlkanesById(currentAlkaneTokens, [existingFail.alkaneid, nonExistingFail.alkaneid])
    
    const result = await syncAlkaneTokensV2(new MockLogger())

    expect(result).toEqual({
      blocksSynced: 1,
      blocksSkippedOrFailed: 0,
      alkanesUnsynced: 4,
      syncedAlkanes: 2,
      failedToSync: 2
    })

    const existingFailFromDb = await database.alkaneTokenV2.findOne({ alkaneId: existingFail.alkaneid })
    expect(existingFailFromDb?.synced).toBe(false)
    expect(existingFailFromDb?.initialised).toBe(true)

    const existingSuccessFromDb = await database.alkaneTokenV2.findOne({ alkaneId: existingSuccess.alkaneid })
    expect(existingSuccessFromDb?.synced).toBe(true)
    expect(existingSuccessFromDb?.initialised).toBe(true)
    compareDbTokenData(existingSuccessFromDb, existingSuccess)

    const nonExistingFailFromDb = await database.alkaneTokenV2.findOne({ alkaneId: nonExistingFail.alkaneid })
    expect(nonExistingFailFromDb?.synced).toBe(false)
    expect(nonExistingFailFromDb?.initialised).toBe(false)

    const nonExistingSuccessFromDb = await database.alkaneTokenV2.findOne({ alkaneId: nonExistingSuccess.alkaneid })
    expect(nonExistingSuccessFromDb?.synced).toBe(true)
    expect(nonExistingSuccessFromDb?.initialised).toBe(true)
    compareDbTokenData(nonExistingSuccessFromDb, nonExistingSuccess)
  })

  it('should handle empty blocks with no token interactions', async () => {
    await setup({
      lastSyncedHeight: 900000,
      currentBlockHeight: 900002
    })

    // Mock empty blocks
    vi.mocked(getInteractedAlkaneTokensInBlock)
      .mockResolvedValueOnce(new Set())
      .mockResolvedValueOnce(new Set())

    vi.mocked(getAlkanesByIds).mockResolvedValue([])

    const result = await syncAlkaneTokensV2(new MockLogger())

    expect(result).toEqual({
      blocksSynced: 2,
      blocksSkippedOrFailed: 0,
      alkanesUnsynced: 0,
      syncedAlkanes: 0,
      failedToSync: 0
    })

    const syncHeight = (await database.syncStatus.findOne({}))?.alkaneSyncBlockHeight
    expect(syncHeight).toBe(900002)

    expect(getInteractedAlkaneTokensInBlock).toHaveBeenCalledTimes(2)
    expect(getInteractedAlkaneTokensInBlock).toHaveBeenCalledWith(900001)
    expect(getInteractedAlkaneTokensInBlock).toHaveBeenCalledWith(900002)
  })

  it('should handle no unsynced tokens', async () => {
    await setup({
      lastSyncedHeight: 900000,
      currentBlockHeight: 900000
    })

    vi.mocked(getAlkanesByIds).mockResolvedValue([])

    const result = await syncAlkaneTokensV2(new MockLogger())

    expect(result).toEqual({
      blocksSynced: 0,
      blocksSkippedOrFailed: 0,
      alkanesUnsynced: 0,
      syncedAlkanes: 0,
      failedToSync: 0
    })

    expect(getAlkanesByIds).not.toHaveBeenCalled()
  })
})


function compareDbTokenData(dbToken: WithId<AlkaneTokenV2> | null, token: UnisatAlkaneToken) {
  expect(dbToken).toBeDefined()
  
  expect(dbToken?.name).toBe(token.tokenData.name)
  expect(dbToken?.symbol).toBe(token.tokenData.symbol)
  expect(dbToken?.logoUrl).toBe(token.logo)
  expect(dbToken?.deployTxid).toBe(token.txid)

  expect(dbToken?.holdersCount).toBe(token.tokenData.holders)
  expect(dbToken?.mintable).toBe(token.tokenData.mintable)
  expect(dbToken?.currentMintCount).toBe(token.tokenData.minted)
  
  expect(dbToken?.deployTimestamp).toBeInstanceOf(Date)
}
