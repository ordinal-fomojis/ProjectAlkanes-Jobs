import { syncAlkaneTokensV2 } from "../jobs/syncAlkaneTokensV2.js"
import { syncBrcTokens } from "../jobs/syncBrcTokens.js"
import { BrcType } from "../utils/constants.js"
import { registerJob } from "./registerJob.js"

registerJob({ syncTokens: async log => {
  await syncAlkaneTokensV2(log)
  await syncBrcTokens(log, BrcType.Default)
  await syncBrcTokens(log, BrcType.SixByte)
}})
