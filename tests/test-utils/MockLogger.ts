import { vi } from 'vitest'
import { Logger } from "../../src/utils/Logger.js"

export class MockLogger extends Logger {
  trace = vi.fn()
  debug = vi.fn()
  info = vi.fn()
  warn = vi.fn()
  error = vi.fn()
}
