import { app } from "@azure/functions"
import { syncAlkaneTokens } from "../jobs/syncAlkaneTokens.js"
import { syncBrctokens } from "../jobs/syncBrcTokens.js"
import { ContextLogger } from "../utils/Logger.js"

app.timer('syncTokens', {
  schedule: '0 * * * * *',
  handler: async (_, context) => {
    await syncAlkaneTokens(new ContextLogger(context))
    await syncBrctokens(new ContextLogger(context))
  }
})
