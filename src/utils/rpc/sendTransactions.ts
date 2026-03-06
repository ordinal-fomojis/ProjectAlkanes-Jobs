import z from "zod"
import { callMultiRpc } from "./callMultiRpc.js"

const PAGE_SIZE = 200
interface SendTransactionsArg { txid: string, txHex: string }

export async function sendTransactions(txns: SendTransactionsArg[]) {
  if (txns.length === 0) return []

  const results: (Awaited<ReturnType<typeof sendTransactionsBase>>)[] = []
  for (let i = 0; i < txns.length; i += PAGE_SIZE) {
    const page = txns.slice(i, i + PAGE_SIZE)
    results.push(await sendTransactionsBase(page))
  }

  return results.flat()
}

async function sendTransactionsBase(txns: SendTransactionsArg[]) {
  const responses = await callMultiRpc(z.string(), txns.map(({ txHex }) => ['sendrawtransaction', [txHex]]))

  return responses.map((response, i) => {
    const txid = txns[i]?.txid
    if (txid == null)
      throw new Error(`Transaction ID not found for index ${i.toString()}`)
    
    return { txid, response }
  })
}
