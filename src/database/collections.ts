import { ObjectId } from "mongodb"

export interface MempoolTransaction {
  txid: string
  mintId?: string
}

export interface AlkaneToken {
  alkaneId: string
  name: string | null
  symbol: string | null
  logoUrl: string | null
  preminedSupply: string
  amountPerMint: string | null
  mintCountCap: string | null
  // Numeric approximation for indexing/sorting.
  // Will typically be exact, but for large values we will get numeric rounding,
  // so calculations should use mintCountCap.
  approximateMintCountCap: number | null
  currentSupply: string
  currentMintCount: number
  deployTxid: string | null
  deployTimestamp: Date | null
  synced: boolean
  blockSyncedAt: number
  clonedFrom: string | null
  percentageMinted: number | null
  maxSupply: string | null
  mintedOut: boolean
  preminedPercentage: number | null
  hasPremine: boolean
}

export interface BrcToken {
  ticker: string
  synced: boolean
  initialised: boolean
  selfMint: boolean
  holdersCount: number
  inscriptionNumber: number
  inscriptionId: string
  max: string
  limit: string
  minted: string
  totalMinted: string
  confirmedMinted: string
  confirmedMinted1h: string
  confirmedMinted24h: string
  mintTimes: number
  decimal: number
  deployHeight: number
  deployBlocktime: number
  completeHeight: number
  completeBlocktime: number
  inscriptionNumberStart: number
  inscriptionNumberEnd: number
}

export interface BlockHeight {
  height: number
  synced: boolean
  // If block is not synced, timestamp is not necessarily accurate
  timestamp: Date
}

export interface SyncStatus {
  brcSyncBlockHeight: number | null
}

export interface UnconfirmedTransaction {
  wif?: string
  txid: string
  txHex: string
  broadcastFailedAtHeight: number | null
  broadcastError: string | null
  broadcasted: boolean
  // A transaction is mined if it is in a confirmed block.
  // It is confirmed after it has six or more confirmations (after which it will no longer be in this dataset).
  mined: boolean
  mock: boolean
  mintTx?: ObjectId
  created: Date
}

export interface ConfirmedTransaction {
  wif?: string
  txid: string
  txHex: string
  mock: boolean
  mintTx?: ObjectId
  created: Date
}

export const CollectionName = {
  MempoolTransaction: 'mempool_transactions',
  AlkaneToken: 'alkane_tokens',
  BlockHeight: 'block_heights',
  UnconfirmedTransaction: 'unconfirmed_transactions',
  ConfirmedTransaction: 'confirmed_transactions',
  SyncStatus: 'sync_status',
  BrcToken: 'brc_tokens'
} as const
export type CollectionName = (typeof CollectionName)[keyof typeof CollectionName]

export interface DataBaseType {
  [CollectionName.MempoolTransaction]: MempoolTransaction
  [CollectionName.AlkaneToken]: AlkaneToken
  [CollectionName.BlockHeight]: BlockHeight
  [CollectionName.UnconfirmedTransaction]: UnconfirmedTransaction
  [CollectionName.ConfirmedTransaction]: ConfirmedTransaction
  [CollectionName.SyncStatus]: SyncStatus
  [CollectionName.BrcToken]: BrcToken
}
