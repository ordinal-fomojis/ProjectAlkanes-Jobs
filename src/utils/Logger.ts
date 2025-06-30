import { InvocationContext } from "@azure/functions"

export abstract class Logger {
  abstract trace(message: string, ...args: unknown[]): void;
  abstract debug(message: string, ...args: unknown[]): void;
  abstract info(message: string, ...args: unknown[]): void;
  abstract warn(message: string, ...args: unknown[]): void;
  abstract error(message: string, ...args: unknown[]): void;
}

export class ContextLogger extends Logger {
  constructor(private context: InvocationContext) {
    super()
  }

  trace(message: string, ...args: unknown[]) {
    this.context.trace(message, ...args)
  }
  
  debug(message: string, ...args: unknown[]) {
    this.context.debug(message, ...args)
  }

  info(message: string, ...args: unknown[]) {
    this.context.info(message, ...args)
  }

  warn(message: string, ...args: unknown[]) {
    this.context.warn(message, ...args)
  }

  error(message: string, ...args: unknown[]) {
    this.context.error(message, ...args)
  }
}
