import { syncMempoolMints } from "../database/syncCalculatedFields.js"
import { registerJob } from "./registerJob.js"

registerJob({ syncCalculatedFields: async () => {
  await syncMempoolMints(null)
}})
