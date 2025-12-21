import { syncMempoolMintsV2 } from "../database/syncCalculatedFields.js"
import { registerJob } from "./registerJob.js"

registerJob({ syncCalculatedFields: async () => {
  await syncMempoolMintsV2(null)
}})
