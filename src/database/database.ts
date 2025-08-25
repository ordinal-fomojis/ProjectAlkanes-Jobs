import { ClientSession, Collection, Db, MongoClient, WithTransactionCallback } from 'mongodb'
import { CollectionName, DataBaseType } from './collections.js'

type CollectionMap = { [C in CollectionName]?: Collection<DataBaseType[C]> }

class Database {
  private client: MongoClient | null = null
  private db: Db | null = null
  private collections: CollectionMap = {}

  get blockHeight() {
    return this.collections.block_heights ??= this.getCollection(CollectionName.BlockHeight)
  }

  get alkaneToken() {
    return this.collections.alkane_tokens ??= this.getCollection(CollectionName.AlkaneToken)
  }

  get mempoolTransaction() {
    return this.collections.mempool_transactions ??= this.getCollection(CollectionName.MempoolTransaction)
  }

  get unconfirmedTransaction() {
    return this.collections.unconfirmed_transactions ??= this.getCollection(CollectionName.UnconfirmedTransaction)
  }

  get confirmedTransaction() {
    return this.collections.confirmed_transactions ??= this.getCollection(CollectionName.ConfirmedTransaction)
  }

  get syncStatus() {
    return this.collections.sync_status ??= this.getCollection(CollectionName.SyncStatus)
  }

  get brcToken() {
    return this.collections.brc_tokens ??= this.getCollection(CollectionName.BrcToken)
  }

  get mintTransaction() {
    return this.collections.mint_transactions ??= this.getCollection(CollectionName.MintTransaction)
  }

  async connect(uri: string, dbName: string) {
    this.client ??= new MongoClient(uri)
    await this.client.connect()
    this.db = this.client.db(dbName)
  }

  async disconnect() {
    await this.client?.close()
  }

  get isConnected(): boolean {
    return this.db != null
  }

  private getCollection<T extends CollectionName>(name: T) {
    if (this.db == null) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db.collection<DataBaseType[T]>(name)
  }

  async withTransaction<T>(
    callback: WithTransactionCallback<T>, options?: Parameters<ClientSession['withTransaction']>[1]
  ) {
    if (this.client == null) {
      throw new Error('Database client not initialized. Call connect() first.');
    }
    const session = this.client.startSession()
    try {
      return await session.withTransaction(callback, options)
    } finally {
      await session.endSession()
    }
  }
}

export const database = new Database()
