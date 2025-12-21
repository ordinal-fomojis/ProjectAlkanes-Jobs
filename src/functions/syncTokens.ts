import { syncAlkaneTokens } from "../jobs/syncAlkaneTokens.js"
import { syncBrcTokens } from "../jobs/syncBrcTokens.js"
import { BrcType } from "../utils/constants.js"
import { registerJob } from "./registerJob.js"

registerJob({ syncTokens: async log => {
  await syncAlkaneTokens(log)
  await syncBrcTokens(log, BrcType.Default)
  await syncBrcTokens(log, BrcType.SixByte)
}})
