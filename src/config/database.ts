import { ClientSession, Db, MongoClient, WithTransactionCallback } from 'mongodb'

class Database {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  async connect(uri: string, dbName: string) {
    try {
      this.client ??= new MongoClient(uri)
      await this.client.connect();
      this.db = this.client.db(dbName);
      console.log('✅ Connected to MongoDB');
      console.log(`📊 Database: ${dbName}`);
    } catch (error) {
      console.error('❌ Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      await this.client?.close();
      console.log('🔌 Disconnected from MongoDB');
    } catch (error) {
      console.error('❌ Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  get isConnected(): boolean {
    return this.db != null
  }

  getDb(): Db {
    if (this.db == null) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
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
