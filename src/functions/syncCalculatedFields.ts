import { app } from "@azure/functions"
import { syncCalculatedFields } from "../database/syncCalculatedFields.js"

app.timer('syncPendingMints', {
  schedule: '0 0 * * * *',
  handler: async () => { await syncCalculatedFields(null, { syncMintable: true, syncPendingMints: true }) }
})
