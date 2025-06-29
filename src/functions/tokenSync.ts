import { app, InvocationContext, Timer } from "@azure/functions";

export async function tokenSync(myTimer: Timer, context: InvocationContext): Promise<void> {
  context.log('Timer function processed request.');
}

app.timer('tokenSync', {
  schedule: '0 */5 * * * *',
  handler: tokenSync
})
