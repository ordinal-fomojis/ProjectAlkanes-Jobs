import { app } from "@azure/functions"
import { syncTokens } from "../jobs/syncTokens.js"
import { ContextLogger } from "../utils/Logger.js"

app.timer('tokenSync', {
  schedule: '0 */1 * * * *',
  handler: async (_, context) => { await syncTokens(new ContextLogger(context)) }
})
