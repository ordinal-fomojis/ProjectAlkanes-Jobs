import { app } from "@azure/functions"
import { syncAlkaneTokens } from "../jobs/syncAlkaneTokens.js"
import { ContextLogger } from "../utils/Logger.js"

app.timer('syncTokens', {
  schedule: '0 * * * * *',
  handler: async (_, context) => { await syncAlkaneTokens(new ContextLogger(context)) }
})
