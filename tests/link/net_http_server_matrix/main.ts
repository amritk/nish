// `nish/net/http-server`'s answers that never reach the program and its
// Alt-Svc advertisement, the same on every carrier it serves
// (docs/http-one-handler.md §8.2): the screen, a deferred answer, a dropped
// one past `maxResponseFields` and a one-byte window on h2c and HTTP/3, then
// the Alt-Svc rows. The rows are in `rows.ts`; `net_http_server_caps` and
// `net_http_server_timeouts` run the rest, each inside the link-test limit.
import { Secret, secret, wipe } from "nish:secret"
import { Suite } from "nish/testing"
import { leafPrivate } from "../net_tls_common/server"
import { rigLimits, Rig } from "../net_http_server_carriers/rig"
import { altSvc, h2cScreen, h3Screen, SMALL_BODY } from "./rows"

export const main = (): i32 => {
  const t = new Suite("http server matrix")
  const key: Secret<u8[]> = secret(leafPrivate())
  const limits = rigLimits(1024)
  limits.maxBody = SMALL_BODY
  const rig = new Rig(limits, true, 4)
  h2cScreen(t, rig, key)
  h3Screen(t, rig, key)
  altSvc(t, rig, key)
  wipe(key)
  return t.done()
}
