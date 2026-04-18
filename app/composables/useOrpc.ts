import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { RouterClient } from '@orpc/server'
import type { AppRouter } from '../../server/orpc/router'

let client: RouterClient<AppRouter> | null = null

export function useOrpc() {
  if (!client) {
    client = createORPCClient(
      new RPCLink({
        url: `${window.location.origin}/rpc`
      })
    )
  }

  return client
}
