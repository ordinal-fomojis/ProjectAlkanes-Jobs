import { afterEach, beforeEach, vi } from 'vitest'
import createFetchMock from 'vitest-fetch-mock'

const fetchMocker = createFetchMock(vi)

fetchMocker.enableMocks();

beforeEach(() => {
  vi.resetAllMocks()
  fetchMock.resetMocks()
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})
