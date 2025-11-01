import { z } from "zod"
import { parse } from "./parse.js"

export const DEFAULT_RETRY_FETCH_TIMES = 4

export class RequestError extends Error {
  constructor(public status: number, public text: string, public url: string) {
    super(`Request to ${url} failed with error ${status.toString()}: ${text}`)
  }
}

export interface RetryFetchOptions {
  retries?: number
  retryCondition?: (error: unknown, base: () => boolean) => Promise<boolean> | boolean
  delay?: (attempt: number, error: unknown, base: () => number) => Promise<number> | number
}

export async function retryResponseFetch(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1], options: RetryFetchOptions = {}) {
  const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : input.toString())
  for (let attempt = 1;; attempt++) {
    try {
      const response = await fetch(input, init)
      if (response.ok) {
        return response
      } else {
        throw new RequestError(response.status, await response.text(), url)
      }
    } catch (error) {
      if (error instanceof DOMException && (error.name === 'AbortError' || error.name === "TimeoutError")) {
        throw error
      }

      const delay = await calculateDelay(options, attempt, error)
      if (delay == null) {
        throw error
      }
      await new Promise(r => setTimeout(r, delay))
    }
  }
}

export async function retryBlobFetch(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1], options: RetryFetchOptions = {}) {
  return await retryResponseFetch(input, init, options).then(x => x.blob())
}

export async function retryFetch(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1], options: RetryFetchOptions = {}) {  
  return await retryResponseFetch(input, init, options).then(x => x.text())
}

export async function retryJsonFetch(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1], options: RetryFetchOptions = {}) {
  return await retryResponseFetch(input, init, options).then(x => x.json())
}

export async function retryBufferFetch(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1], options: RetryFetchOptions = {}) {
  return await retryResponseFetch(input, init, options).then(x => x.arrayBuffer())
}

export async function retrySchemaFetch<Output, Input>(schema: z.ZodType<Output, Input>, ...args: Parameters<typeof retryJsonFetch>) {
  return await retryJsonFetch(...args).then(response => parse(schema, response))
}

async function calculateDelay(options: RetryFetchOptions, attempt: number, error: unknown) {
  if (attempt >= (options.retries ?? DEFAULT_RETRY_FETCH_TIMES)) return null
  const shouldRetry = await options.retryCondition?.(error, () => baseCondition(error)) ?? baseCondition(error)
  if (!shouldRetry) return null
  const delay = await options.delay?.(attempt, error, () => baseDelay(attempt)) ?? baseDelay(attempt)
  return jitter(delay)
}

const retry400Codes = [429, 408, 425, 413]
function baseCondition(error: unknown) {
  if (error instanceof RequestError) {
    return error.status >= 500 || retry400Codes.includes(error.status)
  }
  return true
}

function baseDelay(attempt: number) {
  return 100 * Math.pow(2, attempt)
}

function jitter(time: number) {
  return time * (0.9 + Math.random() * 0.2)
}
