import { InvocationContext } from "@azure/functions"

export abstract class Logger {
  abstract trace(message: string, ...args: any[]): void;
  abstract debug(message: string, ...args: any[]): void;
  abstract info(message: string, ...args: any[]): void;
  abstract warn(message: string, ...args: any[]): void;
  abstract error(message: string, ...args: any[]): void;
}

export class ContextLogger extends Logger {
  constructor(private context: InvocationContext) {
    super()
  }

  trace(message: string, ...args: any[]) {
    this.context.trace(message, ...args)
  }
  
  debug(message: string, ...args: any[]) {
    this.context.debug(message, ...args)
  }

  info(message: string, ...args: any[]) {
    this.context.info(message, ...args)
  }

  warn(message: string, ...args: any[]) {
    this.context.warn(message, ...args)
  }

  error(message: string, ...args: any[]) {
    this.context.error(message, ...args)
  }
}
