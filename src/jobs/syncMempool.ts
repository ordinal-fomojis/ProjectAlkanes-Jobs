import { Transaction } from "bitcoinjs-lib"
import { database } from "../config/database.js"
import { decodeAlkaneOpCallsInTransaction } from "../utils/decoder.js"
import { Logger } from "../utils/Logger.js"
import { getMempoolTransactionIds } from "../utils/rpc/getMempoolTransactionIds.js"
import { getRawTransactions } from "../utils/rpc/getRawTransactions.js"

const MAX_TXNS_PER_SYNC = 2000

interface MempoolTransaction {
  txid: string
  mintId?: string
}

export async function syncMempool(log: Logger) {
  const collection = database.getDb().collection<MempoolTransaction>('mempool_transactions')

  const mempoolTxIds = await getMempoolTransactionIds()
  log.info(`Found ${mempoolTxIds.length} transactions in the mempool.`)
  const mempoolTxIdsSet = new Set(mempoolTxIds)

  const dbTxIds = (await collection.find().toArray()).map(tx => tx.txid)
  const dbTxIdsSet = new Set(dbTxIds)
  
  const newTxns = mempoolTxIds.filter(txid => !dbTxIdsSet.has(txid))

  const txnsToDelete = dbTxIds.filter(txid => !mempoolTxIdsSet.has(txid))

  if (txnsToDelete.length > 0) {
    await collection.deleteMany({ txid: { $in: txnsToDelete } })
  }
  log.info(`Deleted ${txnsToDelete.length} transactions from the database.`)

  const mempoolTransactions = newTxns.length === 0 ? [] : (
    await getRawTransactions(newTxns.slice(0, MAX_TXNS_PER_SYNC))).filter(x => x.success)
      .map(x => {
        const tx = Transaction.fromHex(x.response)
        const mintId = decodeAlkaneOpCallsInTransaction(tx).find(call => call.opcode === 77)?.alkaneId
        const txid = tx.getId()
        return mintId == null ? { txid } : { txid, mintId }
      }
    )

  if (mempoolTransactions.length > 0) {
    await collection.insertMany(mempoolTransactions)
  }
  log.info(`Inserted ${mempoolTransactions.length} new transactions into the database.`)
}
