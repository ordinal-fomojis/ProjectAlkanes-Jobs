import { app } from "@azure/functions"
import { syncPendingMints } from "../database/syncPendingMints.js"

app.timer('syncPendingMints', {
  schedule: '0 0 * * * *',
  handler: async () => { await syncPendingMints(null) }
})
