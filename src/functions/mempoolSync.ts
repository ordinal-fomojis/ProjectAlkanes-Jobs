import { app, InvocationContext, Timer } from "@azure/functions";

export async function mempoolSync(myTimer: Timer, context: InvocationContext): Promise<void> {
  context.log('Timer function processed request.');
}

app.timer('mempoolSync', {
  schedule: '0 */5 * * * *',
  handler: mempoolSync
})
