import { app } from "@azure/functions"
import { ContextLogger, Logger } from "../utils/Logger.js"
import '../utils/constants.js'

type JobConfig = Record<string, (log: Logger) => Promise<unknown>>

export function registerJob(config: JobConfig) {
  if (Object.keys(config).length !== 1) {
    throw new Error('Config must contain exactly one job')
  }

  const f = Object.entries(config)[0]
  if (f == null) throw new Error('No job found in config')

  const [name, job] = f
  const cronExpression = process.env[`${nameToEnvVar(name)}_CRON`]
  if (cronExpression == null || cronExpression === '') return

  app.timer(name, {
    schedule: cronExpression,
    handler: async (_, context) => { await job(new ContextLogger(context)) }
  })
}

function nameToEnvVar(name: string) {
  return name.replace(/([A-Z])/g, '_$1').toUpperCase()
}
