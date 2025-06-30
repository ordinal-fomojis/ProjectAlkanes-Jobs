import { app } from '@azure/functions'
import { DB_NAME, MONGODB_URI } from './config/constants.js'
import { database } from './config/database.js'

app.hook.appStart(async () => {
  await database.connect(MONGODB_URI, DB_NAME)
})

app.hook.appTerminate(async () => {
  await database.disconnect();
})
