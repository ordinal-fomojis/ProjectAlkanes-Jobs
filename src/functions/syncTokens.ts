import { syncAlkaneTokens } from "../jobs/syncAlkaneTokens.js"
import { syncBrcTokens } from "../jobs/syncBrcTokens.js"
import { registerJob } from "./registerJob.js"

registerJob({ syncTokens: async log => {
  await syncAlkaneTokens(log)
  await syncBrcTokens(log)
}})
