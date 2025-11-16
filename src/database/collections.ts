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

export interface AlkaneTokenV2 {
  alkaneId: string
  name: string | null
  symbol: string | null
  logoUrl: string | null
  preminedSupply: string
  amountPerMint: string | null
  mintCountCap: string | null // Calculated based on preminedSupply / amountPerMint
  // Numeric approximation for indexing/sorting.
  // Will typically be exact, but for large values we will get numeric rounding,
  // so calculations should use mintCountCap.
  approximateMintCountCap: number | null
  currentSupply: string
  currentMintCount: number
  deployTxid: string | null
  deployTimestamp: Date | null
  synced: boolean
  percentageMinted: number | null
  maxSupply: string | null
  mintedOut: boolean
  preminedPercentage: number | null
  hasPremine: boolean
  mintable: boolean
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
  decimal: number
  deployHeight: number
  tickerLength: number

  mintedOut: boolean
  mintable: boolean
  deployTimestamp: Date
  percentageMinted: number
  currentMintCount: number
}

export interface BlockHeight {
  height: number
  synced: boolean
  // If block is not synced, timestamp is not necessarily accurate
  timestamp: Date
}

export interface SyncStatus {
  brcSyncBlockHeight: number | null
  brcProgSyncBlockHeight: number | null
  alkaneSyncBlockHeight: number | null
}

interface EncryptedWif {
  iv: string
  data: string
}

export interface UnconfirmedTransaction {
  encryptedWif?: EncryptedWif
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
  // random id that is identical for all transactions in a single request
  requestId: string
  created: Date
}

export interface ConfirmedTransaction {
  encryptedWif?: EncryptedWif
  txid: string
  txHex: string
  mock: boolean
  mintTx?: ObjectId
  // random id that is identical for all transactions in a single request
  requestId: string
  created: Date
}

export interface MintTransaction {
  encryptedWif: EncryptedWif
  serviceFee: number
  networkFee: number
  paddingCost: number
  totalCost: number
  paymentTxid: string
  tokenId: string // Ticker for Brc, Id for Alkanes
  type: 'brc' | 'alkane'
  mintCount: number
  paymentAddress: string
  receiveAddress: string
  authenticatedUserAddress?: string
  txids: string[]
  // random id that is identical for all transactions in a single request
  requestId: string
  created: Date
  confirmed: boolean
}

export const CollectionName = {
  MempoolTransaction: 'mempool_transactions',
  AlkaneToken: 'alkane_tokens',
  AlkaneTokenV2: 'alkane_tokens_v2',
  BlockHeight: 'block_heights',
  UnconfirmedTransaction: 'unconfirmed_transactions',
  ConfirmedTransaction: 'confirmed_transactions',
  SyncStatus: 'sync_status',
  BrcToken: 'brc_tokens',
  MintTransaction: 'mint_transactions'
} as const
export type CollectionName = (typeof CollectionName)[keyof typeof CollectionName]

export interface DataBaseType {
  [CollectionName.MempoolTransaction]: MempoolTransaction
  [CollectionName.AlkaneToken]: AlkaneToken
  [CollectionName.AlkaneTokenV2]: AlkaneTokenV2
  [CollectionName.BlockHeight]: BlockHeight
  [CollectionName.UnconfirmedTransaction]: UnconfirmedTransaction
  [CollectionName.ConfirmedTransaction]: ConfirmedTransaction
  [CollectionName.SyncStatus]: SyncStatus
  [CollectionName.BrcToken]: BrcToken
  [CollectionName.MintTransaction]: MintTransaction
}
