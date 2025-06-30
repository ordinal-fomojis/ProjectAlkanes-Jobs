const DEFAULT_THROTTLE_LIMIT = 10

interface ThrottledPromiseOptions {
  limit?: number
  signal?: AbortSignal
}

type PromiseAllReturn<T extends readonly (() => unknown)[]> = Promise<{ readonly [P in keyof T]: Awaited<ReturnType<T[P]>> }>
export async function throttledPromiseAll<T extends readonly (() => unknown)[]>(promises: T, options: ThrottledPromiseOptions = {}): PromiseAllReturn<T> {
  const controller = new AbortController()
  return await throttledPromise(promises, { ...options, signal: options.signal == null ? controller.signal : AbortSignal.any([controller.signal, options.signal]) }, 
    (result, finished, i) => { finished[i] = result },
    (error, _finished, _, reject) => { controller.abort(); reject(error) }
  ) as PromiseAllReturn<T>
}

type PromiseAllSettledReturn<T extends readonly (() => unknown)[]> = Promise<{ readonly [P in keyof T]: PromiseSettledResult<Awaited<ReturnType<T[P]>>> }>
export async function throttledPromiseAllSettled<T extends readonly (() => unknown)[]>(promises: T, options: ThrottledPromiseOptions = {}): PromiseAllSettledReturn<T> {
  return await throttledPromise(promises, options, 
    (result, finished, i) => {
      finished[i] = {
        status: 'fulfilled',
        value: result
      }
    },
    (error, finished, i) => {
      finished[i] = {
        status: 'rejected',
        reason: error
      }
    }
  ) as PromiseAllSettledReturn<T>
}

type OnComplete = (result: unknown, finished: unknown[], index: number, reject: (reason: unknown) => void) => void

async function throttledPromise<T extends readonly (() => unknown)[]>(promises: T, options: ThrottledPromiseOptions, onResolve: OnComplete, onReject: OnComplete) {
  const limit = options.limit ?? DEFAULT_THROTTLE_LIMIT
  return new Promise((resolve, reject) => {
    const todo = promises.map((promise, i) => ({ promise, i }))
    const pending: unknown[] = []
    const finished: unknown[] = []

    function initiatePromise() {
      if (options.signal?.aborted === true) {
        reject(new DOMException('Aborted', 'AbortError'))
        return false
      }
      if (todo.length + pending.length === 0) {
        resolve(finished)
        return false
      }
      if (pending.length >= limit) return false
      if (todo.length === 0) return false
      
      const { promise, i } = todo.shift()!
      pending.push(promise)
      Promise.resolve(promise())
        .then(result => { onResolve(result, finished, i, reject) })
        .catch((error: unknown) => { onReject(error, finished, i, reject) })
        .finally(() => {
          const index = pending.indexOf(promise)
          pending.splice(index, 1)
          while(initiatePromise());
        })
      return true
    }

    while (initiatePromise());
  })
}
