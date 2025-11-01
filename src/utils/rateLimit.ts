import z from "zod"
import { RequestError, RetryFetchOptions, retrySchemaFetch } from "./retryFetch.js"

class RateLimitError extends Error {
  constructor(error: RequestError, retries: number) {
    super(`Rate limit exceeded after ${retries} retries: ${error.message}`)
    this.name = 'RateLimitError'
  }
}

export interface RateLimitOptions {
  requestsPerSecond: number
  isRateLimitError?: (error: RequestError) => boolean
  // After this many rate limits in a row, a RateLimitError is thrown.
  // This should signify that the server will likely continue to rate limit,
  // and subsequent requests should be given up on
  maxRateLimits?: number
  // The number of times to retry a request due to an error other than a rate limit.
  // Corresponds to the `retries` option in retryFetch
  defaultRetries?: number
}

export interface RateLimitContext {
  rateLimitMs: number
  rateLimitRetries: number
  maxRateLimits: number
  isRateLimitError: (error: unknown) => error is RequestError
  wait: () => Promise<void>
  retryOptions: RetryFetchOptions
  lastRequestTime?: number
}

export function createRateLimitContext(options: RateLimitOptions): RateLimitContext {
  const context: RateLimitContext = {
    rateLimitRetries: 0,
    maxRateLimits: options.maxRateLimits ?? 10,
    rateLimitMs: (1000 / options.requestsPerSecond) * 1.05,
    isRateLimitError: (error: unknown): error is RequestError =>
      error instanceof RequestError && (options.isRateLimitError?.(error) === true || error.status === 429),
    wait: async () => {
      if (context.lastRequestTime == null)
        return
      const elapsedTime = performance.now() - context.lastRequestTime
      const delay = Math.max(0, context.rateLimitMs - elapsedTime)
      if (delay === 0) return
      
      await new Promise(r => setTimeout(r, delay))
      context.lastRequestTime = performance.now()
    },
    retryOptions: {
      retries: options.defaultRetries,
      delay: (_, error, base) => context.isRateLimitError(error) ? 10 * base() : base(),
      retryCondition: (error, base) => {
        if (context.rateLimitRetries >= context.maxRateLimits) return false
        const isRateLimit = context.isRateLimitError(error)
        
        if (isRateLimit)
          context.rateLimitRetries++
        else
          context.rateLimitRetries = 0

        return isRateLimit ? true : base()
      }
    }
  }
  return context
}

export async function rateLimitFetch<Output, Input>(
  schema: z.ZodType<Output, Input>, input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1], context?: RateLimitContext
) {
  if (context == null)
    return retrySchemaFetch(schema, input, init)

  if (context.rateLimitRetries >= context.maxRateLimits) {
    const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : input.toString())
    const error = new RequestError(429,
      `Request was not attempted, because server has ratelimited ${context.rateLimitRetries} times in a row`, url)
    throw new RateLimitError(error, context.rateLimitRetries)
  }

  try {
    await context.wait()
    const result = await retrySchemaFetch(schema, input, init, context.retryOptions)
    context.rateLimitRetries = 0
    return result
  } catch (error) {
    if (context.isRateLimitError(error) && context.rateLimitRetries >= context.maxRateLimits) {
      throw new RateLimitError(error, context.rateLimitRetries)
    }
    throw error
  }
}
