import { WithId } from "mongodb"
import { MongoMemoryServer } from "mongodb-memory-server"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { BrcToken, SyncStatus } from "../../src/database/collections.js"
import { database } from "../../src/database/database.js"
import { syncBrctokens } from "../../src/jobs/syncBrcTokens.js"
import { DB_NAME } from "../../src/utils/constants.js"
import { getAllBrcTokens } from "../../src/utils/unisat/getAllBrcTokens.js"
import { getBestBrcBlockHeight } from "../../src/utils/unisat/getBestBrcBlockHeight.js"
import { getBrcByTicker } from "../../src/utils/unisat/getBrcByTicker.js"
import { MockLogger } from "../test-utils/MockLogger.js"
import Random from "../test-utils/Random.js"

vi.mock("../../src/utils/unisat/getBestBrcBlockHeight.js")
vi.mock("../../src/utils/unisat/getAllBrcTokens.js")
vi.mock("../../src/utils/unisat/getBrcByTicker.js")

let mongodb: MongoMemoryServer
beforeAll(async () => {
  mongodb = await MongoMemoryServer.create()
  await database.connect(mongodb.getUri(), DB_NAME)
})

afterAll(async () => {
  await database.disconnect()
  await mongodb.stop()
})

function randomBrcTokenResponse(): Awaited<ReturnType<typeof getBrcByTicker>> {
  const max = Random.randomIntLessThan(1000000000)
  const minted = Random.randomIntLessThan(max).toString(10)
  return {
    ticker: Random.randomString({ length: 4, charset: 'alpha' }),
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
  initialBrcTokenResponse?: Awaited<ReturnType<typeof getBrcByTicker>>[]
}

async function setup({ syncStatus = null, currentBlockHeight = 900000, initialBrcTokenResponse = [] }: SetupArgs = {}) {
  await database.syncStatus.deleteMany()
  if (syncStatus != null) {
    await database.syncStatus.insertOne(syncStatus)
  }
  vi.mocked(getBestBrcBlockHeight).mockResolvedValue(currentBlockHeight)
  vi.mocked(getAllBrcTokens).mockResolvedValue(initialBrcTokenResponse)
}

describe('syncBrcTokens', () => {
  it('should do initial sync if no sync status exists', async () => {
    const initialTokens = Array.from({ length: 10 }, () => randomBrcTokenResponse())
    await setup({ syncStatus: null, initialBrcTokenResponse: initialTokens })

    const result = await syncBrctokens(new MockLogger())

    expect(result).toEqual({
      blocksSynced: 0,
      blocksSkippedOrFailed: 0,
      tokensUnsynced: 0,
      syncedTokens: 10,
      failedToSync: 0
    })
    for (const token of initialTokens) {
      const dbToken = await database.brcToken.findOne({ ticker: token.ticker })
      compareDbTokenData(dbToken, token)
    }
    
    await database.brcToken.deleteMany({ ticker: { $in: initialTokens.map(t => t.ticker) } })
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
  expect(dbToken?.mintTimes).toBe(token.mintTimes)
  expect(dbToken?.decimal).toBe(token.decimal)
  expect(dbToken?.deployHeight).toBe(token.deployHeight)
  expect(dbToken?.deployBlocktime).toBe(token.deployBlocktime)
  expect(dbToken?.completeHeight).toBe(token.completeHeight)
  expect(dbToken?.completeBlocktime).toBe(token.completeBlocktime)
  expect(dbToken?.inscriptionNumberStart).toBe(token.inscriptionNumberStart)
  expect(dbToken?.inscriptionNumberEnd).toBe(token.inscriptionNumberEnd)
}
