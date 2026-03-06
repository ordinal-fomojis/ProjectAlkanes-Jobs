import { Block } from "bitcoinjs-lib"
import { readFileSync } from "fs"
import { describe, expect, it, vi } from "vitest"
import z from "zod"
import { callMultiRpc } from "../../../src/utils/rpc/callMultiRpc.js"
import { getRawBlocks } from "../../../src/utils/rpc/getRawBlocks.js"
import { dataPath } from "../../test-utils/dataPath.js"

vi.mock("../../../src/utils/rpc/callMultiRpc.js")

interface SetupArgs {
  data: {
    height: number,
    hashSuccessful?: boolean,
    blockSuccessful?: boolean
  }[]
}

function setup({ data } : SetupArgs) {
  const blocks = data.map(({ height, hashSuccessful, blockSuccessful }) => {
    const hex = readFileSync(dataPath('blocks', `${height.toString()}.hex`), 'utf-8')
    const hash = Buffer.from(Block.fromHex(hex).getHash().toReversed()).toString('hex')

    const hashResponse = hashSuccessful !== false
      ? { success: true, response: hash, params: [height] } as const
      : { success: false, error: new Error('Failed to get block hash'), params: [height] } as const

    const blockResponse = blockSuccessful !== false
      ? { success: true, response: hex, params: [hash, 0] } as const
      : { success: false, error: new Error('Failed to get block'), params: [hash, 0] } as const

    return { height, hex, hash, hashResponse, blockResponse }
  })

  vi.mocked(callMultiRpc)
    .mockResolvedValueOnce(blocks.map(b => b.hashResponse))
    .mockResolvedValueOnce(blocks.filter(b => b.hashResponse.success).map(b => b.blockResponse))

  return { blocks }
}

describe('getRawBlocks', () => {
  it('should fetch blocks with the correct parameters and handle success cases', async () => {
    const { blocks } = setup({ data: [{ height: 903140 }, { height: 902375 }] })

    const result = await getRawBlocks(blocks.map(b => b.height))

    expect(callMultiRpc).toHaveBeenCalledTimes(2)
    
    expect(callMultiRpc).toHaveBeenNthCalledWith(1,
      expect.any(z.ZodType),
      blocks.map(({ height }) => ['getblockhash', [height]] as const)
    )
    expect(callMultiRpc).toHaveBeenNthCalledWith(2,
      expect.any(z.ZodType),
      blocks.map(({ hash }) => ['getblock', [hash, 0]] as const)
    )

    expect(result).toHaveLength(2)
    for (const block of blocks) {
      expect(result).toContainEqual({
        success: true,
        response: expect.toSatisfy((b: Block) => Buffer.from(b.getHash().toReversed()).toString('hex') === block.hash),
        params: [block.hash, 0],
        height: block.height
      })
    }
  })

  it('should handle failures in fetching block hashes', async () => {
    const { blocks } = setup({ data: [{ height: 903140, hashSuccessful: false }, { height: 902375 }] })

    const result = await getRawBlocks(blocks.map(b => b.height))

    expect(callMultiRpc).toHaveBeenCalledTimes(2)

    expect(result).toHaveLength(2)
    
    for (const block of blocks) {
      if (block.height === 903140) {
        expect(result).toContainEqual({
          success: false,
          error: expect.any(Error),
          params: [block.height],
          height: block.height
        })
      } else {
        expect(result).toContainEqual({
          success: true,
          response: expect.toSatisfy((b: Block) => Buffer.from(b.getHash().toReversed()).toString('hex') === block.hash),
          params: [block.hash, 0],
          height: block.height
        })
      }
    }
  })

  it('should handle failures in fetching blocks', async () => {
    const { blocks } = setup({ data: [{ height: 903140, blockSuccessful: false }, { height: 902375 }] })

    const result = await getRawBlocks(blocks.map(b => b.height))

    expect(callMultiRpc).toHaveBeenCalledTimes(2)
    expect(result).toHaveLength(2)
    
    for (const block of blocks) {
      if (block.height === 903140) {
        expect(result).toContainEqual({
          success: false,
          error: expect.any(Error),
          params: [block.hash, 0],
          height: block.height
        })
      } else {
        expect(result).toContainEqual({
          success: true,
          response: expect.toSatisfy((b: Block) => Buffer.from(b.getHash().toReversed()).toString('hex') === block.hash),
          params: [block.hash, 0],
          height: block.height
        })
      }
    }
  })

  it('should deduplicate block heights', async () => {
    const { blocks } = setup({ data: [{ height: 903140 }, { height: 902375 }] })

    const result = await getRawBlocks([903140, 903140, 902375])

    expect(callMultiRpc).toHaveBeenCalledTimes(2)
    
    expect(callMultiRpc).toHaveBeenNthCalledWith(1,
      expect.any(z.ZodType),
      blocks.map(({ height }) => ['getblockhash', [height]] as const)
    )
    expect(callMultiRpc).toHaveBeenNthCalledWith(2,
      expect.any(z.ZodType),
      blocks.map(({ hash }) => ['getblock', [hash, 0]] as const)
    )

    expect(result).toHaveLength(2)
    for (const block of blocks) {
      expect(result).toContainEqual({
        success: true,
        response: expect.toSatisfy((b: Block) => Buffer.from(b.getHash().toReversed()).toString('hex') === block.hash),
        params: [block.hash, 0],
        height: block.height
      })
    }
  })

  it('should throw an error if hash-to-height mapping fails', async () => {
    const { blocks } = setup({ data: [{ height: 903140 }] })

    vi.mocked(callMultiRpc)
      .mockReset()
      .mockResolvedValueOnce(blocks.map(b => b.hashResponse))
      .mockResolvedValueOnce([{
        success: true as const,
        response: blocks[0]?.hex ?? '',
        params: ['wrong-hash', 0] as [string, number]
      }])

    // Execute and expect error
    await expect(getRawBlocks([903140])).rejects.toThrow(/Block height not found for hash/)
  })
  
  it('should handle a mix of successful and failed operations correctly', async () => {
    const { blocks } = setup({ data: [
      { height: 902375 },
      { height: 903139, hashSuccessful: false },
      { height: 903140, blockSuccessful: false }
    ] })

    const result = await getRawBlocks(blocks.map(b => b.height))

    expect(result).toHaveLength(3)
    for (const block of blocks) {
      if (block.height === 902375) {
        expect(result).toContainEqual({
          success: true,
          response: expect.toSatisfy((b: Block) => Buffer.from(b.getHash().toReversed()).toString('hex') === block.hash),
          params: [block.hash, 0],
          height: block.height
        })
      } else {
        expect(result).toContainEqual({
          success: false,
          error: expect.any(Error),
          params: expect.any(Array),
          height: block.height
        })
      }
    }
  })
})
