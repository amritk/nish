// `nish/net/http-server`'s pool and per-connection caps on h2c and HTTP/3
// (docs/http-one-handler.md §8.2): `requests` 8 holds two streams per
// connection and refuses the third, four connections hold the pool and a
// fifth is refused; `requests` 1, 2 and 3 hold one stream per connection and
// refuse the next connection. The rows are in `net_http_server_matrix/rows.ts`.
import { Secret, secret, wipe } from "nish:secret"
import { Suite } from "nish/testing"
import { leafPrivate } from "../net_tls_common/server"
import { caps8, capsSmall } from "../net_http_server_matrix/rows"

export const main = (): i32 => {
  const t = new Suite("http server caps")
  const key: Secret<u8[]> = secret(leafPrivate())
  caps8(t, key)
  capsSmall(t, key, 1)
  capsSmall(t, key, 2)
  capsSmall(t, key, 3)
  wipe(key)
  return t.done()
}
