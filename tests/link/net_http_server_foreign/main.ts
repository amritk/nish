// A request answered through a server other than the one it was taken from
// panics, before that server's pool or carriers are touched.
import { bare, Taken } from "../net_http_server/taken"
import { HttpServerLimits } from "nish/net/http-server"

export const main = (): i32 => {
  const t = new Taken("/")
  bare(new HttpServerLimits()).empty(t.req, 204)
  console.log("FAIL  the call returned")
  return 0
}
