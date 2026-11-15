// A watched id outside 0 to 15 panics: `fired` could never report it.
import { bare } from "../net_http_server/taken"
import { HttpServerLimits } from "nish/net/http-server"

export const main = (): i32 => {
  const h = bare(new HttpServerLimits())
  h.watch(0, 16)
  console.log("FAIL  the call returned")
  return 0
}
