import { syncCalculatedFields } from "../database/syncCalculatedFields.js"
import { registerJob } from "./registerJob.js"

registerJob({ syncCalculatedFields: async () => {
  await syncCalculatedFields(null, { syncMintable: true, syncPendingMints: true })
}})
