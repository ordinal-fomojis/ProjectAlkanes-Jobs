import { app } from "@azure/functions"
import { syncPendingMints } from "../database/syncPendingMints.js"

app.timer('syncMempool', {
  schedule: '0 0 * * * *',
  handler: async () => { await syncPendingMints(null) }
})
