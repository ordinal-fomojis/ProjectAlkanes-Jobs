import { app } from '@azure/functions'
import { DB_NAME, MONGODB_URI } from './database/constants.js'
import { database } from './database/database.js'

app.hook.appStart(async () => {
  await database.connect(MONGODB_URI, DB_NAME)
})

app.hook.appTerminate(async () => {
  await database.disconnect();
})
