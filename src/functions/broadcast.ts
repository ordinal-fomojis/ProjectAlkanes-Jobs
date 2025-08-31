import { broadcast } from "../jobs/broadcast.js"
import { registerJob } from "./registerJob.js"

registerJob({ broadcast })
