export interface MempoolTransaction {
  txid: string
  mintId?: string
}

export interface AlkaneToken {
  alkaneId: string
  name: string | null
  symbol: string | null
  logoUrl: string | null
  preminedSupply: number
  amountPerMint: number | null
  mintCountCap: number | null
  currentSupply: number
  currentMintCount: number
  deployTxid: string | null
  deployTimestamp: Date | null
  synced: boolean
  blockSyncedAt: number
}

export interface BlockHeight {
  height: number
  synced: boolean
  // If block is not synced, timestamp is not necessarily accurate
  timestamp: Date
}

export const CollectionName = {
  MempoolTransaction: 'mempool_transactions',
  AlkaneToken: 'alkane_tokens',
  BlockHeight: 'block_heights'
} as const
export type CollectionName = (typeof CollectionName)[keyof typeof CollectionName]

export interface DataBaseType {
  [CollectionName.MempoolTransaction]: MempoolTransaction
  [CollectionName.AlkaneToken]: AlkaneToken
  [CollectionName.BlockHeight]: BlockHeight
}
