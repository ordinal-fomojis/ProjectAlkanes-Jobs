import { Transaction } from "bitcoinjs-lib"
import { database } from "../database/database.js"
import { syncPendingMints } from "../database/syncPendingMints.js"
import { decodeAlkaneOpCallsInTransaction } from "../utils/decoder.js"
import { Logger } from "../utils/Logger.js"
import { getMempoolTransactionIds } from "../utils/rpc/getMempoolTransactionIds.js"
import { getRawTransactions } from "../utils/rpc/getRawTransactions.js"

export async function syncMempool(log: Logger) {
  const mempoolTxIds = await getMempoolTransactionIds()
  log.info(`Found ${mempoolTxIds.length.toString()} transactions in the mempool.`)
  const mempoolTxIdsSet = new Set(mempoolTxIds)

  const dbTxns = await database.mempoolTransaction.find().toArray()
  const dbTxnMintMap = new Map(dbTxns.map(tx => [tx.txid, tx.mintId]))
  
  const newTxns = mempoolTxIds.filter(txid => !dbTxnMintMap.has(txid))

  const txnsToDelete = dbTxns.filter(txn => !mempoolTxIdsSet.has(txn.txid))

  const mempoolTransactions = newTxns.length === 0 ? [] : (
    await getRawTransactions(newTxns)).filter(x => x.success)
      .map(x => {
        const tx = Transaction.fromHex(x.response)
        const mintId = decodeAlkaneOpCallsInTransaction(tx).find(call => call.opcode === 77)?.alkaneId
        const txid = tx.getId()
        return mintId == null ? { txid } : { txid, mintId }
      }
    )

  const deletedAlkanes = txnsToDelete.map(x => x.mintId).filter(x => x != null)
  const newAlkanes = mempoolTransactions.map(x => x.mintId).filter(x => x != null)
  const modifiedAlkanes = new Set(deletedAlkanes.concat(newAlkanes))

  await database.withTransaction(async () => {
    if (txnsToDelete.length > 0) {
      await database.mempoolTransaction.deleteMany({ txid: { $in: txnsToDelete.map(x => x.txid) } })
    }
    log.info(`Deleted ${txnsToDelete.length.toString()} transactions from the database.`)

    if (mempoolTransactions.length > 0) {
      await database.mempoolTransaction.insertMany(mempoolTransactions)
    }
    log.info(`Inserted ${mempoolTransactions.length.toString()} new transactions into the database.`)

    if (modifiedAlkanes.size > 0) {
      log.info(`Syncing ${modifiedAlkanes.size.toString()} alkanes due to mempool changes.`)
      await syncPendingMints({ alkaneId: { $in: Array.from(modifiedAlkanes) } })
    } else {
      log.info("No alkanes to sync from mempool changes.")
    }
  })

  return {
    deletedCount: txnsToDelete.length,
    createdCount: mempoolTransactions.length
  }
}
