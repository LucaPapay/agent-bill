import { ORPCError, os } from '@orpc/server'

export type RPCContext = {
  personId: null | string
}

export const rpc = os.$context<RPCContext>()

export const protectedRpc = rpc.use(({ context, next }) => {
  if (!context.personId) {
    throw new ORPCError('UNAUTHORIZED')
  }

  return next({
    context: {
      personId: context.personId,
    },
  })
})
