// `take` with no request ready panics: `ready` says when one is.
import { bare } from "../net_http_server/taken"
import { HttpServerLimits } from "nish/net/http-server"

export const main = (): i32 => {
  const h = bare(new HttpServerLimits())
  h.take()
  console.log("FAIL  the call returned")
  return 0
}
