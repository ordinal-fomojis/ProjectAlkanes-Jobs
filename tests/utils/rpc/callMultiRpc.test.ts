import { describe, expect, it, vi } from 'vitest'
import z from "zod"
import { callMultiRpc } from '../../../src/utils/rpc/callMultiRpc.js'
import { callRpc } from '../../../src/utils/rpc/callRpc.js'

vi.mock('../../../src/utils/rpc/callRpc.js')

describe('callMultiRpc', () => {
  it('should process successful responses correctly', async () => {
    vi.mocked(callRpc)
      .mockResolvedValueOnce('result1')
      .mockResolvedValueOnce('result2')

    const params: [string, unknown[]][] = [
      ['method1', ['param1']],
      ['method2', ['param2']]
    ]
    
    const result = await callMultiRpc(z.string(), params)
    
    expect(callRpc).toHaveBeenCalledWith(expect.any(z.ZodType), 'method1', ['param1'])
    expect(callRpc).toHaveBeenCalledWith(expect.any(z.ZodType), 'method2', ['param2'])
    
    expect(result).toEqual([
      { success: true, response: 'result1', params: ['param1'] },
      { success: true, response: 'result2', params: ['param2'] }
    ])
  })

  it('should handle failed RPC calls correctly', async () => {
    vi.mocked(callRpc).mockResolvedValueOnce('result1').mockRejectedValueOnce(new Error('RPC error'))

    const params: [string, unknown[]][] = [
      ['method1', ['param1']],
      ['method2', ['param2']]
    ]
    
    const result = await callMultiRpc(z.string(), params)
    
    expect(result).toEqual([
      { success: true, response: 'result1', params: ['param1'] },
      { success: false, error: expect.any(Error), params: ['param2'] }
    ])
  })
})
