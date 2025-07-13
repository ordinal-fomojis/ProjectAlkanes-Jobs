import { app } from "@azure/functions"
import { broadcast } from "../jobs/broadcast.js"
import { ContextLogger } from "../utils/Logger.js"

app.timer('broadcast', {
  schedule: '20 * * * * *',
  handler: async (_, context) => { await broadcast(new ContextLogger(context)) }
})
