import { ClientSession, Db, MongoClient, WithTransactionCallback } from 'mongodb'

export const CollectionName = {
  MempoolTransaction: 'mempool_transactions'
} as const
type CollectionName = (typeof CollectionName)[keyof typeof CollectionName]

export interface MempoolTransaction {
  txid: string
  mintId?: string
}

interface DataBaseType {
  [CollectionName.MempoolTransaction]: MempoolTransaction
}

class Database {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  async connect(uri: string, dbName: string) {
    this.client ??= new MongoClient(uri)
    await this.client.connect()
    this.db = this.client.db(dbName)
  }

  async disconnect() {
    await this.client?.close();
  }

  get isConnected(): boolean {
    return this.db != null
  }

  getCollection<T extends CollectionName>(name: T) {
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
