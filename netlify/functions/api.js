const serverless = require('serverless-http')

let handlerPromise

async function getHandler() {
  if (!handlerPromise) {
    handlerPromise = import('../../server/index.js')
      .then(async ({ app, initialize }) => {
        await initialize()
        return serverless(app)
      })
      .catch((error) => {
        handlerPromise = null
        throw error
      })
  }
  return handlerPromise
}

module.exports.handler = async (event, context) => {
  const handler = await getHandler()
  return handler(event, context)
}
