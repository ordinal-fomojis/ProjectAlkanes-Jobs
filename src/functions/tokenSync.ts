import { app, InvocationContext, Timer } from "@azure/functions"

export async function tokenSync(_: Timer, context: InvocationContext): Promise<void> {
  await Promise.resolve() // Simulate async operation
  context.log('Timer function processed request.');
}

app.timer('tokenSync', {
  schedule: '0 */5 * * * *',
  handler: tokenSync
})
