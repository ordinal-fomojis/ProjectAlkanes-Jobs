import { app } from '@azure/functions'
import { database } from './database/database.js'
import { DB_NAME, MONGODB_URI } from './utils/constants.js'

app.hook.appStart(async () => {
  await database.connect(MONGODB_URI, DB_NAME)
})

app.hook.appTerminate(async () => {
  await database.disconnect();
})
