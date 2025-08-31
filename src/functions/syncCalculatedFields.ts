import { app } from "@azure/functions"
import { syncCalculatedFields } from "../database/syncCalculatedFields.js"
import { registerJob } from "./registerJob.js"

registerJob({ syncCalculatedFields: async () => {
  await syncCalculatedFields(null, { syncMintable: true, syncPendingMints: true })
}})

app.timer('syncCalculatedFields', {
  schedule: '0 0 * * * *',
  handler: async () => { await syncCalculatedFields(null, { syncMintable: true, syncPendingMints: true }) }
})
