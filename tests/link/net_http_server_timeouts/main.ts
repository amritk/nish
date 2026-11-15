// `nish/net/http-server`'s timeouts (docs/http-one-handler.md §8.2):
// `bodyTimeout` on h2c (RST_STREAM CANCEL) and HTTP/3
// (H3_REQUEST_CANCELLED, sending stopped), and `idleTimeout` on HTTP/2 over
// TLS. The rows are in `net_http_server_matrix/rows.ts`.
import { Secret, secret, wipe } from "nish:secret"
import { Suite } from "nish/testing"
import { leafPrivate } from "../net_tls_common/server"
import { timeouts } from "../net_http_server_matrix/rows"

export const main = (): i32 => {
  const t = new Suite("http server timeouts")
  const key: Secret<u8[]> = secret(leafPrivate())
  timeouts(t, key)
  wipe(key)
  return t.done()
}
