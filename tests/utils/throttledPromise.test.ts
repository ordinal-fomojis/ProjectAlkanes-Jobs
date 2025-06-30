import { describe, expect, it } from "vitest"
import { throttledPromiseAll, throttledPromiseAllSettled } from "../../src/utils/throttledPromise.js"

describe('throttledPromiseAllSettled', () => {
  it('should throttle promises and resolve all rejected and resolved values', async () => {
    const resolvers: (() => void)[] = []
    const promises = Array.from({ length: 10 }, (_, i) => () => new Promise<number>((resolve, reject) => {
      if (i % 2 === 0) {
        resolvers.push(() => { resolve(i) })
      } else {
        resolvers.push(() => { reject(new Error(i.toString())) })
      }
    }))

    const throttledPromise = throttledPromiseAllSettled(promises, { limit: 3 })

    for (let i = 0; i < 10; i++) {
      expect(resolvers.length).toBe(Math.min(3, 10 - i))
      resolvers.shift()?.()
      await new Promise(r => setTimeout(r, 0))
    }

    await expect(throttledPromise).resolves.toEqual(Array.from({ length: 10 }, (_, i) => {
      if (i % 2 === 0) {
        return { status: 'fulfilled', value: i }
      } else {
        return { status: 'rejected', reason: new Error(i.toString()) }
      }
    }))
  })
})

describe('throttledPromiseAll', () => {
  it('should reject if any promise rejects, and reject to the value of the first rejected promise', async () => {
    const promises = Array.from({ length: 10 }, (_, i) => () => new Promise<string>((resolve, reject) => {
      if (i === 5 || i == 6) {
        reject(new Error(i.toString()))
      } else {
        resolve(i.toString())
      }
    }))

    await expect(throttledPromiseAll(promises, { limit: 3 })).rejects.toThrow('5')
  })

  it('should reject when the first promise rejects', async () => {
    const promises = Array.from({ length: 10 }, (_, i) => () => new Promise<string>((_, reject) => {
      if (i === 0) {
        reject(new Error(i.toString()))
      }
    }))

    await expect(throttledPromiseAll(promises, { limit: 3 })).rejects.toThrow('0')
  })

  it('should throttle promises and resolve if all promises resolve', async () => {
    const resolvers: (() => void)[] = []
    const promises = Array.from({ length: 10 }, (_, i) => () => new Promise<number>(r => resolvers.push(() => { r(i) })))

    const throttledPromise = throttledPromiseAll(promises, { limit: 3 })

    for (let i = 0; i < 10; i++) {
      expect(resolvers.length).toBe(Math.min(3, 10 - i))
      resolvers.shift()?.()
      await new Promise(r => setTimeout(r, 0))
    }

    await expect(throttledPromise).resolves.toEqual([...Array(10).keys()])
  })
})
