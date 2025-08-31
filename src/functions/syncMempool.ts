import { syncMempool } from "../jobs/syncMempool.js"
import { registerJob } from "./registerJob.js"

registerJob({ syncMempool })
