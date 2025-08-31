import { syncAlkaneTokens } from "../jobs/syncAlkaneTokens.js"
import { syncBrctokens } from "../jobs/syncBrcTokens.js"
import { registerJob } from "./registerJob.js"

registerJob({ syncTokens: async log => {
  await syncAlkaneTokens(log)
  await syncBrctokens(log)
}})
