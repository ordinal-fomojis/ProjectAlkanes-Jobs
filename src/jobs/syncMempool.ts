import { Transaction } from "bitcoinjs-lib"
import { database } from "../database/database.js"
import { decodeAlkaneOpCallsInTransaction } from "../utils/decoder.js"
import { Logger } from "../utils/Logger.js"
import { getMempoolTransactionIds } from "../utils/rpc/getMempoolTransactionIds.js"
import { getRawTransactions } from "../utils/rpc/getRawTransactions.js"

const MAX_TXNS_PER_SYNC = 2000

export async function syncMempool(log: Logger) {
  const mempoolTxIds = await getMempoolTransactionIds()
  log.info(`Found ${mempoolTxIds.length.toString()} transactions in the mempool.`)
  const mempoolTxIdsSet = new Set(mempoolTxIds)

  const dbTxIds = (await database.mempoolTransaction.find().toArray()).map(tx => tx.txid)
  const dbTxIdsSet = new Set(dbTxIds)
  
  const newTxns = mempoolTxIds.filter(txid => !dbTxIdsSet.has(txid))

  const txnsToDelete = dbTxIds.filter(txid => !mempoolTxIdsSet.has(txid))

  if (txnsToDelete.length > 0) {
    await database.mempoolTransaction.deleteMany({ txid: { $in: txnsToDelete } })
  }
  log.info(`Deleted ${txnsToDelete.length.toString()} transactions from the database.`)

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
    await database.mempoolTransaction.insertMany(mempoolTransactions)
  }
  log.info(`Inserted ${mempoolTransactions.length.toString()} new transactions into the database.`)

  return {
    deletedCount: txnsToDelete.length,
    createdCount: mempoolTransactions.length
  }
}
