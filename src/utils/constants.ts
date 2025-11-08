import { config } from '@dotenvx/dotenvx'
import { z } from 'zod'
import { parse } from '../utils/parse.js'

export const ENV = parse(z.enum(['production', 'development', 'test']).default('development'), process.env.NODE_ENV)

config({
  path: ENV === 'test'
    ? '.env.sample'
    : process.env.DOTENV_PATH,
  quiet: true
})

export type BitcoinNetwork = typeof BITCOIN_NETWORK
export const BITCOIN_NETWORK = parse(z.enum(['mainnet', 'signet', 'testnet'])
  .default('mainnet'), process.env.BITCOIN_NETWORK)

export const SANDSHREW_API_KEY = parse(
  z.string({ message: "SANDSHREW_API_KEY is missing" }), process.env.SANDSHREW_API_KEY)

export const ORDISCAN_API_KEY = parse(
  z.string({ message: "ORDISCAN_API_KEY is missing" }), process.env.ORDISCAN_API_KEY)

export const UNISAT_API_KEY = parse(
  z.string({ message: "UNISAT_API_KEY is missing" }), process.env.UNISAT_API_KEY)

const BitcoinRpcUrls = {
  'mainnet': `https://mainnet.sandshrew.io/v1/${SANDSHREW_API_KEY}`,
  'signet': `https://signet.sandshrew.io/v1/${SANDSHREW_API_KEY}`,
  'testnet': `https://testnet.sandshrew.io/v1/${SANDSHREW_API_KEY}`
}

export const BITCOIN_RPC_URL = BitcoinRpcUrls[BITCOIN_NETWORK]

export const MONGODB_URI = parse(z.string({ message: "MONGODB_URI is missing" }), process.env.MONGODB_URI)
export const DB_NAME = parse(z.string().default('project-alkanes'), process.env.MONGODB_DB_NAME)

export const BrcType = {
  Default: 'default',
  SixByte: '6-byte'
} as const

export type BrcType = typeof BrcType[keyof typeof BrcType]
