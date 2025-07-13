import { Transaction } from "bitcoinjs-lib"
import { AnyBulkWriteOperation } from "mongodb"
import { ConfirmedTransaction, UnconfirmedTransaction } from "../database/collections.js"
import { database } from "../database/database.js"
import { Logger } from "../utils/Logger.js"
import { getBlockHeight } from "../utils/rpc/getBlockHeight.js"
import { getTransactionConfirmations } from "../utils/rpc/getTransactionConfirmations.js"
import { sendTransactions } from "../utils/rpc/sendTransactions.js"

export async function broadcast(log: Logger) {
  log.info('Starting broadcast job')
  const blockHeight = await getBlockHeight()

  const transactions = await database.unconfirmedTransaction.find({ broadcastFailedAtHeight: { $ne: blockHeight } }).toArray()

  const unbroadcasted = transactions.filter(tx => !tx.broadcasted && !tx.mock)
  const broadcasted = transactions.filter(tx => tx.broadcasted || tx.mock)

  const unconfirmedUpdates: AnyBulkWriteOperation<UnconfirmedTransaction>[][] = []

  await handleBroadcasts({ log, transactions: unbroadcasted, unconfirmedUpdates, blockHeight })
  const confirmedTxns = await handleUnconfirmed({ log, transactions: broadcasted, unconfirmedUpdates })
  
  await database.withTransaction(async session => {
    await database.unconfirmedTransaction.bulkWrite(unconfirmedUpdates.flat(), session)
    await database.confirmedTransaction.insertMany(confirmedTxns, session)
  })

  log.info('Successfully finished broadcast job')
}

interface HandleUnconfirmedArgs {
  log: Logger,
  transactions: UnconfirmedTransaction[]
  unconfirmedUpdates: AnyBulkWriteOperation<UnconfirmedTransaction>[][]
}

async function handleUnconfirmed({ log, transactions, unconfirmedUpdates } : HandleUnconfirmedArgs): Promise<ConfirmedTransaction[]> {
  if (transactions.length === 0) {
    log.info('No transactions to check for confirmations.')
    return []
  }
  log.info(`Checking ${transactions.length.toString()} broadcasted transactions, to check if they are confirmed.`)
  const confirmations = await getTransactionConfirmations(transactions.filter(tx => !tx.mock).map(x => x.txid))
  
  const unbroadcasted = confirmations.filter(x => !x.broadcasted).map(x => x.txid)
  const mined = confirmations.filter(x => x.broadcasted && x.confirmations > 0).map(x => x.txid)
  const confirmed = confirmations.filter(x => x.broadcasted && x.confirmations >= 6).map(x => x.txid)
  const mocked = transactions.filter(tx => tx.mock).map(tx => tx.txid)

  log.info(`${unbroadcasted.length.toString()} transactions were not in the mempool.`)
  log.info(`${mined.length.toString()} transactions have been mined.`)
  log.info(`${confirmed.length.toString()} transactions have been confirmed.`)
  log.info(`${mocked.length.toString()} transactions are auto confirmed as they are mocked.`)

  const allConfirmed = confirmed.concat(mocked)

  unconfirmedUpdates.push([
    {
      updateMany: {
        filter: { txid: { $in: unbroadcasted } },
        update: { $set: { broadcasted: false, mined: false, broadcastFailedAtHeight: null, broadcastError: null } }
      }
    },
    {
      updateMany: {
        filter: { txid: { $in: mined } },
        update: { $set: { broadcasted: true, mined: true, broadcastFailedAtHeight: null, broadcastError: null } }
      }
    },
    {
      deleteMany: { filter: { txid: { $in: allConfirmed } } }
    }
  ])

  const txMap = new Map(transactions.map(tx => [tx.txid, tx]))

  return allConfirmed.map(txid => {
    const tx = txMap.get(txid)
    if (tx == null) 
      return null
    
    return {
      wif: tx.wif,
      txid: tx.txid,
      txHex: tx.txHex,
      mock: tx.mock,
      mintTx: tx.mintTx,
      created: tx.created
    } satisfies ConfirmedTransaction
  }).filter(x => x != null)
}

interface HandleBroadcastsArgs {
  log: Logger,
  transactions: UnconfirmedTransaction[]
  unconfirmedUpdates: AnyBulkWriteOperation<UnconfirmedTransaction>[][]
  blockHeight: number
}

async function handleBroadcasts({ log, transactions, unconfirmedUpdates, blockHeight } : HandleBroadcastsArgs) {
  if (transactions.length === 0) {
    log.info('No transactions to broadcast.')
    return
  }
  log.info(`Attempting to broadcast ${transactions.length.toString()} transactions.`)

  const transactionBatches: string[][] = []
  const allTxIds = new Set(transactions.map(tx => tx.txid))
  const dependentTxidsMap = new Map(transactions.map(tx => {
    const txn = Transaction.fromHex(tx.txHex)
    const inputTxids = txn.ins.map(input => Buffer.from(input.hash.toReversed()).toString('hex'))
    const dependentIds = inputTxids.filter(txid => allTxIds.has(txid))
    return [tx.txid, dependentIds]
  }))

  const processedTransactions = new Set<string>()
  const remainingTransactions = allTxIds
  while (remainingTransactions.size > 0) {
    const latestBatch = new Set<string>()
    for (const txid of remainingTransactions) {
      const dependentTxids = dependentTxidsMap.get(txid) ?? []
      
      if (dependentTxids.every(dep => processedTransactions.has(dep) && !latestBatch.has(dep))) {
        latestBatch.add(txid)
        processedTransactions.add(txid)
        remainingTransactions.delete(txid)
      }
    }
    transactionBatches.push(Array.from(latestBatch))
  }

  const transactionMap = new Map(transactions.map(tx => [tx.txid, tx]))
  const broadcastResults: Awaited<ReturnType<typeof sendTransactions>>[] = []
  for (const batch of transactionBatches) {
    if (batch.length === 0) continue
    log.info(`Broadcasting batch of ${batch.length.toString()} transactions.`)
    const transactionBatch = batch.map(txid => transactionMap.get(txid)).filter(tx => tx != null)
      .map(tx => ({ txid: tx.txid, txHex: tx.txHex }))
    broadcastResults.push(await sendTransactions(transactionBatch))

    // Wait for 1 second to ensure previous batch of transactions are processed
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  const broadcastResult = broadcastResults.flat()
  const failedBroadcasts = broadcastResult.filter(result => !result.response.success)
  log.info(`Failed to broadcast ${failedBroadcasts.length.toString()} transactions.`)
  const failedBroadcastConfirmations = await getTransactionConfirmations(failedBroadcasts.map(x => x.txid))
  const alreadyBroadcasted = failedBroadcastConfirmations.filter(x => x.broadcasted).map(x => x.txid)
  const notBroadcasted = failedBroadcastConfirmations.filter(x => !x.broadcasted).map(x => x.txid)
  log.info(`${alreadyBroadcasted.length.toString()} transactions failed to broadcast but were already in the mempool.`)
  log.info(`${notBroadcasted.length.toString()} transactions failed to broadcast and were not in the mempool.`)

  const failedBroadcastMap = new Map(failedBroadcasts.map(x => [x.txid, x.response]))

  unconfirmedUpdates.push(notBroadcasted.map(txid => {
    const response = failedBroadcastMap.get(txid)
    return {
      updateOne: {
        filter: { txid },
        update: { $set: {
          broadcastFailedAtHeight: blockHeight,
          broadcastError: response?.success === false ? response.error.message : "Unknown error",
          broadcasted: false,
          mined: false
        } }
      }
    }
  }))

  const successfulBroadcasts = broadcastResult.filter(result => result.response.success).map(x => x.txid)
  log.info(`Successfully broadcasted ${successfulBroadcasts.length.toString()} transactions.`)
  unconfirmedUpdates.push([{
    updateMany: {
      filter: { txid: { $in: successfulBroadcasts.concat(alreadyBroadcasted) } },
      update: { $set: { broadcasted: true, mined: false, broadcastFailedAtHeight: null, broadcastError: null } }
    }
  }])
}
