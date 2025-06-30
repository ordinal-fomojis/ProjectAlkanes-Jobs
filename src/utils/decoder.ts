import { Block, opcodes, script, Transaction } from "bitcoinjs-lib"

export function decodeAlkaneOpCallsInBlock(block: Block) {
  return (block.transactions ?? []).map(tx => ({
    txid: tx.getId(),
    opcalls: decodeAlkaneOpCallsInTransaction(tx)
  })).filter(x => x.opcalls.length > 0)
}

const RUNESTONE_IDENTIFIER = [opcodes.OP_RETURN, opcodes.OP_13]
export function decodeAlkaneOpCallsInTransaction(tx: Transaction) {
  for (const output of tx.outs) {
    const outScript = script.decompile(output.script)
    if (outScript == null) continue
    if (RUNESTONE_IDENTIFIER.some((opcode, index) => opcode !== outScript[index])) continue

    const runestonePushes = outScript.slice(RUNESTONE_IDENTIFIER.length)
    if (runestonePushes.some(x => typeof x === 'number')) return []
    return decodeOpCallsInRunestone(Buffer.concat(runestonePushes.filter(x => !(typeof x === 'number'))))
  }
  return []
}

const PROTORUNE_TAG = BigInt(16383)
const CALLDATA_TAG = BigInt(81)
const MAX_PROTOSTONE_VALUE = BigInt(2) ** BigInt(15 * 8)
function decodeOpCallsInRunestone(runestone: Buffer) {
  const runestoneValues = decodeLeb128(runestone)
  if (runestoneValues == null) return []

  const protostone = decodeTags(runestoneValues).get(PROTORUNE_TAG)
  if (protostone == null || protostone.length === 0) return []

  const protostoneValues = decodeLeb128(Buffer.concat(protostone))
  if (protostoneValues == null || protostoneValues.some(x => bufferToBigint(x) >= MAX_PROTOSTONE_VALUE))
    return []

  const protocolMessages = parseProtostone(protostoneValues)
  return protocolMessages.map(message => {
    const calldata = decodeTags(message).get(CALLDATA_TAG)
    if (calldata == null || calldata.length === 0) return null

    const calldataValues = decodeLeb128(Buffer.concat(calldata))
    if (calldataValues == null) return null

    const alkaneId = calldataValues.slice(0, 2).map(x => bufferToNumber(x)).filter(x => x != null)
    const opcodeBuffer = calldataValues[2]
    const opcode = opcodeBuffer == null ? null : bufferToNumber(opcodeBuffer)
    if (opcode == null || alkaneId.length !== 2) return null
    return { alkaneId: alkaneId.join(':'), opcode }
  }).filter(x => x != null)
}

function parseProtostone(values: Buffer[]) {
  let index = 0
  const protocolMessages: Buffer[][] = []
  while (index < values.length) {
    const protocolBuffer = values[index]
    const sizeBuffer = values[index + 1]
    if (protocolBuffer == null || sizeBuffer == null) break

    const size = bufferToNumber(sizeBuffer)
    if (size == null) return []
    const data = values.slice(index + 2, index + 2 + size)
    if (bufferToBigint(protocolBuffer) === BigInt(1)) {
      protocolMessages.push(data)
    }
    index += 2 + size
  }
  return protocolMessages
}

function bufferToBigint(buffer: Buffer) {
  let value = BigInt(0)
  for (const byte of buffer.toReversed()) {
    value <<= BigInt(8)
    value |= BigInt(byte)
  }
  return value
}

const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER)
function bufferToNumber(buffer: Buffer) {
  const value = bufferToBigint(buffer)
  if (value > MAX_SAFE_INTEGER) return null
  return Number(value)
}

function decodeTags(values: Buffer[]) {
  const tags = new Map<bigint, Buffer[]>()
  let index = 0
  while (index < values.length) {
    const bufferTag = values[index]
    const value = values[index + 1]
    if (bufferTag == null || value == null) break

    const tag = bufferToBigint(bufferTag)
    if (tag === BigInt(0)) break

    const tagValues = tags.get(tag) ?? []
    tagValues.push(value)
    tags.set(tag, tagValues)
    index += 2
  }
  return tags
}

export function decodeLeb128(buffer: Buffer) {
  const values: number[][] = []
  let shift = 0;
  let currentValue: number[] = []
  for (const byte of buffer) {
    const value = byte & 0x7f    
    const shiftedValue = (value << (shift % 8))
    const lo = shiftedValue & 0xff
    const hi = (shiftedValue >> 8) & 0xff
    const loIndex = Math.floor(shift / 8)
    currentValue[loIndex] = (currentValue[loIndex] ?? 0) | lo
    if (shift % 8 > 1) {
      currentValue[loIndex + 1] = (currentValue[loIndex + 1] ?? 0) | hi
    }
    
    shift += 7
    if (shift > 18 * 7) return null
    if ((byte & 0x80) === 0) {
      values.push(currentValue)
      currentValue = []
      shift = 0
    }
  }
  return values.map(x => Buffer.from(x))
}
