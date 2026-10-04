import serverless from 'serverless-http'
import { app, initialize } from '../../server/index.js'

const handle = serverless(app)

export async function handler(event, context) {
  await initialize()
  return handle(event, context)
}
