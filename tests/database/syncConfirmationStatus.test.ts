import { MongoMemoryServer } from "mongodb-memory-server"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { MintTransaction, UnconfirmedTransaction } from "../../src/database/collections.js"
import { database } from "../../src/database/database.js"
import { syncConfirmationStatus } from "../../src/database/syncConfirmationStatus.js"
import { DB_NAME } from "../../src/utils/constants.js"
import Random from "../test-utils/Random.js"

let mongodb: MongoMemoryServer
beforeAll(async () => {
  mongodb = await MongoMemoryServer.create()
  await database.connect(mongodb.getUri(), DB_NAME)
})

afterEach(async () => {
  await database.mintTransaction.deleteMany({})
  await database.unconfirmedTransaction.deleteMany({})
})

afterAll(async () => {
  await database.disconnect()
  await mongodb.stop()
})

function getMintTx(): MintTransaction {
  return {
    encryptedWif: {
      iv: Random.randomHex(16),
      data: Random.randomHex(64)
    },
    serviceFee: 100,
    networkFee: 50,
    paddingCost: 10,
    totalCost: 160,
    tokenId: '2:0',
    type: 'alkane',
    mintCount: 5,
    paymentAddress: "bc1pyh4cva6dwh3wdjl5cyddzlm3n8zvflff0yvkkqjggx294fmjnahs0l0w6r",
    receiveAddress: "bc1pyh4cva6dwh3wdjl5cyddzlm3n8zvflff0yvkkqjggx294fmjnahs0l0w6r",
    paymentTxid: Random.randomTransactionId(),
    txids: Array.from({ length: 5 }, () => Random.randomTransactionId()),
    requestId: crypto.randomUUID(),
    created: new Date(),
    confirmed: false
  }
}

function getTransactions(mintTx: MintTransaction): UnconfirmedTransaction[] {
  return Array.from({ length: 10 }, () => ({
    encryptedWif: mintTx.encryptedWif,
    txid: Random.randomTransactionId(),
    txHex: Random.randomHex(64),
    broadcastFailedAtHeight: null,
    broadcastError: null,
    broadcasted: false,
    mined: false,
    mock: false,
    requestId: mintTx.requestId,
    created: mintTx.created
  }))
}

describe("syncConfirmationStatus", () => {
  it("should be confirmed if there are no unconfirmed transactions", async () => {
    // Arrange
    const mintTx = getMintTx()
    await database.mintTransaction.insertOne(mintTx)

    // Act
    await syncConfirmationStatus([mintTx.requestId])

    // Assert
    const updatedMintTx = await database.mintTransaction.findOne({ requestId: mintTx.requestId })
    expect(updatedMintTx?.confirmed).toBe(true)
  })

  it("should be confirmed if all unconfirmed transactions are mined", async () => {
    // Arrange
    const mintTx = getMintTx()
    await database.mintTransaction.insertOne(mintTx)

    const transactions = getTransactions(mintTx)
    for (const transaction of transactions) {
      transaction.mined = true
    }
    await database.unconfirmedTransaction.insertMany(transactions)

    // Act
    await syncConfirmationStatus([mintTx.requestId])

    // Assert
    const updatedMintTx = await database.mintTransaction.findOne({ requestId: mintTx.requestId })
    expect(updatedMintTx?.confirmed).toBe(true)
  })

  it('should be unconfirmed if there are unconfirmed transactions that are not mined', async () => {
    // Arrange
    const mintTx = getMintTx()
    await database.mintTransaction.insertOne(mintTx)

    const transactions = getTransactions(mintTx)
    for (const transaction of transactions.slice(0, 5)) {
      transaction.mined = true
    }
    await database.unconfirmedTransaction.insertMany(transactions)

    // Act
    await syncConfirmationStatus([mintTx.requestId])

    // Assert
    const updatedMintTx = await database.mintTransaction.findOne({ requestId: mintTx.requestId })
    expect(updatedMintTx?.confirmed).toBe(false)
  })
})
