export const CollectionName = {
  MempoolTransaction: 'mempool_transactions'
} as const
export type CollectionName = (typeof CollectionName)[keyof typeof CollectionName]

export interface MempoolTransaction {
  txid: string
  mintId?: string
}

export interface DataBaseType {
  [CollectionName.MempoolTransaction]: MempoolTransaction
}
