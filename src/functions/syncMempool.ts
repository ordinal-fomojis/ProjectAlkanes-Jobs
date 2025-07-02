import { app } from "@azure/functions"
import { syncMempool } from "../jobs/syncMempool.js"
import { ContextLogger } from "../utils/Logger.js"

app.timer('syncMempool', {
  schedule: '0 * * * * *',
  handler: async (_, context) => { await syncMempool(new ContextLogger(context)) }
})
