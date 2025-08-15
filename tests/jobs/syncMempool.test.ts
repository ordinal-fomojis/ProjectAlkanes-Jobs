import fs from 'fs'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { database } from '../../src/database/database.js'
import { syncMempool } from '../../src/jobs/syncMempool.js'
import { DB_NAME } from '../../src/utils/constants.js'
import { getMempoolTransactionIds } from '../../src/utils/rpc/getMempoolTransactionIds.js'
import { getRawTransactions } from '../../src/utils/rpc/getRawTransactions.js'
import { dataPath } from '../test-utils/dataPath.js'
import { MockLogger } from '../test-utils/MockLogger.js'

vi.mock('../../src/utils/rpc/getMempoolTransactionIds.js')
vi.mock('../../src/utils/rpc/getRawTransactions.js')

let mongodb: MongoMemoryServer
beforeAll(async () => {
  mongodb = await MongoMemoryServer.create()
  await database.connect(mongodb.getUri(), DB_NAME)
})

afterAll(async () => {
  await database.disconnect()
  await mongodb.stop()
})

interface SetupArgs {
  mempool?: string[]
  db?: string[]
}

async function setup({ mempool, db }: SetupArgs = {}) {
  vi.mocked(getRawTransactions).mockImplementation(ids => Promise.resolve(ids.map(id => ({
    success: true,
    response: fs.readFileSync(dataPath('transactions', `${id}.hex`), 'utf8'),
    params: [id]
  }))))

  await database.mempoolTransaction.deleteMany()

  vi.mocked(getMempoolTransactionIds).mockResolvedValue(mempool ?? [])

  if (db != null) {
    await database.mempoolTransaction.insertMany(db.map(txid => ({ txid })))
  }

  return { mempool }
}

describe('syncMempoolTransactions', () => {
  it('should add non existent transactions with correct mint ids', async () => {
    const { mempool } = await setup({
      mempool: [
        "5ade9ef39ddc3b0607ecd425ac201cf02df89898b1a28677605e6bb9a68ec93e",
        "138ba708c9024a720c2ba753e91e6c0c54c5eabc8c04c3ec62924420b2661fe0",
        "c1329565bb5787c7bd48644adfc1c3f86e6db479e8e7177feb082dba3708af12"
      ]
    })
    
    const result = await syncMempool(new MockLogger())
    
    expect(result).toEqual({ deletedCount: 0, createdCount: 3 })
    expect(getMempoolTransactionIds).toHaveBeenCalledOnce()
    expect(getRawTransactions).toHaveBeenCalledExactlyOnceWith(mempool)

    const documents = await database.mempoolTransaction.find().sort({ txid: 'asc' }).toArray()
    expect(documents).toHaveLength(3)
    expect(documents).toEqual([
      expect.objectContaining({
        txid: '138ba708c9024a720c2ba753e91e6c0c54c5eabc8c04c3ec62924420b2661fe0'
      }),
      expect.objectContaining({
        txid: '5ade9ef39ddc3b0607ecd425ac201cf02df89898b1a28677605e6bb9a68ec93e',
        mintId: '2:21666'
      }),
      expect.objectContaining({
        txid: 'c1329565bb5787c7bd48644adfc1c3f86e6db479e8e7177feb082dba3708af12'
      })
    ])
  })

  it('should ignore existing transactions', async () => {
    const mempool = [
      "5ade9ef39ddc3b0607ecd425ac201cf02df89898b1a28677605e6bb9a68ec93e",
      "138ba708c9024a720c2ba753e91e6c0c54c5eabc8c04c3ec62924420b2661fe0",
      "c1329565bb5787c7bd48644adfc1c3f86e6db479e8e7177feb082dba3708af12"
    ]
    await setup({
      mempool, db: mempool
    })
    
    const result = await syncMempool(new MockLogger())
    
    expect(result).toEqual({ deletedCount: 0, createdCount: 0 })
    expect(getMempoolTransactionIds).toHaveBeenCalledOnce()
    expect(getRawTransactions).not.toHaveBeenCalled()

    const documents = await database.mempoolTransaction.find().sort({ txid: 'asc' }).toArray()
    expect(documents).toHaveLength(3)
    expect(documents).toEqual([
      expect.objectContaining({
        txid: '138ba708c9024a720c2ba753e91e6c0c54c5eabc8c04c3ec62924420b2661fe0'
      }),
      expect.objectContaining({
        txid: '5ade9ef39ddc3b0607ecd425ac201cf02df89898b1a28677605e6bb9a68ec93e'
      }),
      expect.objectContaining({
        txid: 'c1329565bb5787c7bd48644adfc1c3f86e6db479e8e7177feb082dba3708af12'
      })
    ])
  })
    
  it('should delete transactions not in mempool', async () => {
    const mempool = [
      "5ade9ef39ddc3b0607ecd425ac201cf02df89898b1a28677605e6bb9a68ec93e",
      "138ba708c9024a720c2ba753e91e6c0c54c5eabc8c04c3ec62924420b2661fe0"
    ]
    const db = [
      "5ade9ef39ddc3b0607ecd425ac201cf02df89898b1a28677605e6bb9a68ec93e",
      "138ba708c9024a720c2ba753e91e6c0c54c5eabc8c04c3ec62924420b2661fe0",
      "c1329565bb5787c7bd48644adfc1c3f86e6db479e8e7177feb082dba3708af12"
    ]
    await setup({ mempool, db })
    
    const result = await syncMempool(new MockLogger())
    
    expect(result).toEqual({ deletedCount: 1, createdCount: 0 })
    expect(getMempoolTransactionIds).toHaveBeenCalledOnce()
    expect(getRawTransactions).not.toHaveBeenCalled()

    const documents = await database.mempoolTransaction.find().sort({ txid: 'asc' }).toArray()
    expect(documents).toHaveLength(2)
    expect(documents).toEqual([
      expect.objectContaining({
        txid: '138ba708c9024a720c2ba753e91e6c0c54c5eabc8c04c3ec62924420b2661fe0'
      }),
      expect.objectContaining({
        txid: '5ade9ef39ddc3b0607ecd425ac201cf02df89898b1a28677605e6bb9a68ec93e'
      })
    ])
  })
    
  it('should filter out failed raw transaction responses', async () => {
    const mempool = [
      "5ade9ef39ddc3b0607ecd425ac201cf02df89898b1a28677605e6bb9a68ec93e",
      "138ba708c9024a720c2ba753e91e6c0c54c5eabc8c04c3ec62924420b2661fe0",
      "c1329565bb5787c7bd48644adfc1c3f86e6db479e8e7177feb082dba3708af12"
    ]
    await setup({ mempool })
    
    vi.mocked(getRawTransactions).mockResolvedValue([
      { success: true, params: ['5ade9ef39ddc3b0607ecd425ac201cf02df89898b1a28677605e6bb9a68ec93e'],
        response: fs.readFileSync(dataPath('transactions', '5ade9ef39ddc3b0607ecd425ac201cf02df89898b1a28677605e6bb9a68ec93e.hex'), 'utf8')
      },
      { success: false, params: ['138ba708c9024a720c2ba753e91e6c0c54c5eabc8c04c3ec62924420b2661fe0'], error: new Error() },
      {
        success: true, params: ['c1329565bb5787c7bd48644adfc1c3f86e6db479e8e7177feb082dba3708af12'],
        response: fs.readFileSync(dataPath('transactions', 'c1329565bb5787c7bd48644adfc1c3f86e6db479e8e7177feb082dba3708af12.hex'), 'utf8')
      }
    ])
    
    const result = await syncMempool(new MockLogger())
    
    expect(result).toEqual({ deletedCount: 0, createdCount: 2 })
    expect(getMempoolTransactionIds).toHaveBeenCalledOnce()
    expect(getRawTransactions).toHaveBeenCalledExactlyOnceWith(mempool)

    const documents = await database.mempoolTransaction.find().sort({ txid: 'asc' }).toArray()
    expect(documents).toHaveLength(2)
    expect(documents).toEqual([
      expect.objectContaining({
        txid: '5ade9ef39ddc3b0607ecd425ac201cf02df89898b1a28677605e6bb9a68ec93e',
        mintId: '2:21666'
      }),
      expect.objectContaining({
        txid: 'c1329565bb5787c7bd48644adfc1c3f86e6db479e8e7177feb082dba3708af12'
      })
    ])
  })
    
  it('should handle both additions and deletions in the same call', async () => {
    const mempool = [
      "5ade9ef39ddc3b0607ecd425ac201cf02df89898b1a28677605e6bb9a68ec93e",
      "138ba708c9024a720c2ba753e91e6c0c54c5eabc8c04c3ec62924420b2661fe0",
    ]
    const db = [
      { txid: '5ade9ef39ddc3b0607ecd425ac201cf02df89898b1a28677605e6bb9a68ec93e', mintId: '2:21666' },
      { txid: 'c1329565bb5787c7bd48644adfc1c3f86e6db479e8e7177feb082dba3708af12' }
    ]
    await setup({ mempool, db: db.map(tx => tx.txid) })

    const result = await syncMempool(new MockLogger())

    expect(result).toEqual({ deletedCount: 1, createdCount: 1 })
    expect(getMempoolTransactionIds).toHaveBeenCalledOnce()
    expect(getRawTransactions)
      .toHaveBeenCalledExactlyOnceWith(["138ba708c9024a720c2ba753e91e6c0c54c5eabc8c04c3ec62924420b2661fe0"])

    const documents = await database.mempoolTransaction.find().sort({ txid: 'asc' }).toArray()
    expect(documents).toHaveLength(2)
    expect(documents).toEqual([
      expect.objectContaining({
        txid: '138ba708c9024a720c2ba753e91e6c0c54c5eabc8c04c3ec62924420b2661fe0'
      }),
      expect.objectContaining({
        txid: '5ade9ef39ddc3b0607ecd425ac201cf02df89898b1a28677605e6bb9a68ec93e',
      })
    ])
  })
})
