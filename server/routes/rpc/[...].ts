import { RPCHandler } from '@orpc/server/fetch'
import { onError } from '@orpc/server'
import { setResponseStatus, toWebRequest } from 'h3'
import { hasPerson } from '../../lib/db'
import { router } from '../../orpc/router'

const handler = new RPCHandler(router, {
  interceptors: [
    onError((error) => {
      console.error(error)
    }),
  ],
})

export default defineEventHandler(async (event) => {
  const request = toWebRequest(event)
  const session = await getUserSession(event)
  let personId = session.user?.personId || null

  if (personId && !(await hasPerson(personId))) {
    await clearUserSession(event)
    personId = null
  }

  const { response } = await handler.handle(request, {
    context: {
      personId,
    },
    prefix: '/rpc',
  })

  if (response) {
    return response
  }

  setResponseStatus(event, 404, 'Not Found')
  return 'Not found'
})
