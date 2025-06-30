import { describe, expect, it, vi } from 'vitest'
import z from "zod"
import { callMultiRpc } from '../../../src/utils/rpc/callMultiRpc.js'
import { callRpc } from '../../../src/utils/rpc/callRpc.js'

vi.mock('../../../src/utils/rpc/callRpc.js')

describe('callMultiRpc', () => {
  it('should process successful responses correctly', async () => {
    vi.mocked(callRpc).mockResolvedValue([
      { result: 'result1' },
      { result: 'result2' }
    ])

    const params: [string, unknown[]][] = [
      ['method1', ['param1']],
      ['method2', ['param2']]
    ]
    
    const result = await callMultiRpc(z.string(), params)
    
    expect(callRpc).toHaveBeenCalledWith(
      expect.any(z.ZodType),
      'sandshrew_multicall',
      params
    )
    
    expect(result).toEqual([
      { success: true, response: 'result1', params: ['param1'] },
      { success: true, response: 'result2', params: ['param2'] }
    ])
  })

  it('should handle failed RPC calls correctly', async () => {
    vi.mocked(callRpc).mockResolvedValue([
      { result: 'result1' },
      { error: { code: -1, message: 'RPC error' } }
    ])

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

  it('should handle empty or null results correctly', async () => {
    // Mock the callRpc response to simulate null results
    vi.mocked(callRpc).mockResolvedValue([
      { result: null }, 
      { result: undefined },
      { error: null }
    ])

    const params: [string, unknown[]][] = [
      ['method1', ['param1']],
      ['method2', ['param2']],
      ['method3', ['param3']]
    ]
    
    const result = await callMultiRpc(z.string().nullish(), params)
    
    expect(result).toEqual([
      { success: false, error: expect.any(Error), params: ['param1'] },
      { success: false, error: expect.any(Error), params: ['param2'] },
      { success: false, error: expect.any(Error), params: ['param3'] }
    ])
  })
})
