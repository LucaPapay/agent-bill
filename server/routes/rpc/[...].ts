import { RPCHandler } from '@orpc/server/fetch'
import { onError } from '@orpc/server'
import { setResponseStatus, toWebRequest } from 'h3'
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
  const { response } = await handler.handle(request, {
    context: {
      personId: session.user?.personId || null,
    },
    prefix: '/rpc',
  })

  if (response) {
    return response
  }

  setResponseStatus(event, 404, 'Not Found')
  return 'Not found'
})
