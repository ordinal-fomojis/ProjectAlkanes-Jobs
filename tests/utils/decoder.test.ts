import { Block, Transaction } from "bitcoinjs-lib"
import fs from "fs"
import { describe, expect, it } from "vitest"
import { decodeAlkaneOpCallsInBlock, decodeAlkaneOpCallsInTransaction } from "../../src/utils/decoder.js"
import { dataPath } from "../test-utils/dataPath.js"

describe("decodeAlkaneOpCallsInTransaction", () => {
  it.each([
    [
      "5ade9ef39ddc3b0607ecd425ac201cf02df89898b1a28677605e6bb9a68ec93e",
      [{ alkaneId: "2:21666", opcode: 77 }]
    ],
    [
      "a827200baed8ea915eee35984aa2f69cb123414f7fbbd4a4b5d4f1dc4fed1b25",
      [{ alkaneId: "2:25684", opcode: 77 }]
    ],
    [
      "138ba708c9024a720c2ba753e91e6c0c54c5eabc8c04c3ec62924420b2661fe0",
      []
    ],
    [
      "c1329565bb5787c7bd48644adfc1c3f86e6db479e8e7177feb082dba3708af12",
      []
    ],
    [
      "6d6dd690e0b97d50f89b6ea4bb827edfbc49a3a1c1a0925f9051903d2c260086",
      []
    ]
  ])("should decode transaction correctly (case %$)", (txid, opCalls) => {
    const hex = fs.readFileSync(dataPath("transactions", `${txid}.hex`), "utf8")
    expect(decodeAlkaneOpCallsInTransaction(Transaction.fromHex(hex))).toEqual(opCalls)
  })
})

describe("decodeAlkaneOpCallsInBlock", () => {
  it.each([
    [
      '902375',
      [
        {
          txid: '1b2fc134708328d6aebbd11e225c8224820631b7db36ba45dc4eec2854715259',
          opcalls: [ { alkaneId: '2:0', opcode: 77 } ]
        },
        {
          txid: 'da9007a2dacd25cbc19701536c8e39a07560c1833b3a9e7add9ed1e309ff1dd5',
          opcalls: [ { alkaneId: '2:0', opcode: 77 } ]
        }
      ]
    ]
  ])('should decode block correctly (case %$)', (block, opCalls) => {
    const hex = fs.readFileSync(dataPath('blocks', `${block}.hex`), 'utf8')
    expect(decodeAlkaneOpCallsInBlock(Block.fromHex(hex))).toEqual(opCalls)
  })
})
