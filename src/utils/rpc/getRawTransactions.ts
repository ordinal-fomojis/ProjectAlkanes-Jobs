import z from "zod"
import { callMultiRpc } from "./callMultiRpc.js"

const PAGE_SIZE = 200

export async function getRawTransactions(txids: string[]) {
  if (txids.length === 0) return []

  const results: (Awaited<ReturnType<typeof getRawTransactionsBase>>)[] = []
  for (let i = 0; i < txids.length; i += PAGE_SIZE) {
    const page = txids.slice(i, i + PAGE_SIZE)
    results.push(await getRawTransactionsBase(page))
  }

  return results.flat()
}

async function getRawTransactionsBase(txids: string[]) {
  return await callMultiRpc(z.string(), txids.map(id => ['getrawtransaction', [id]]))
}
