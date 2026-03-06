import z from "zod"
import { callMultiRpc } from "./callMultiRpc.js"

const PAGE_SIZE = 200

const VerboseTxnSchema = z.object({
  confirmations: z.number().optional()
})

export async function getTransactionConfirmations(txids: string[]) {
  if (txids.length === 0) return []

  const results: (Awaited<ReturnType<typeof getTransactionConfirmationsBase>>)[] = []
  for (let i = 0; i < txids.length; i += PAGE_SIZE) {
    const page = txids.slice(i, i + PAGE_SIZE)
    results.push(await getTransactionConfirmationsBase(page))
  }

  return results.flat()
}

async function getTransactionConfirmationsBase(txids: string[]) {
  const response = await callMultiRpc(VerboseTxnSchema, txids.map(txid => ['getrawtransaction', [txid, true]] as const))
  return response.map(tx => {
    if (!tx.success) {
      return { txid: tx.params[0], broadcasted: false, confirmations: 0 }
    }
    const { confirmations } = tx.response
    return { txid: tx.params[0], broadcasted: true, confirmations: confirmations ?? 0 }
  })
}
