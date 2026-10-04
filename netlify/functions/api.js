module.exports.handler = async (event, context) => {
  const { handler } = await import('./api.mjs')
  return handler(event, context)
}
