// A limit outside its range is the program's bug: the constructor panics
// naming the limit, its value and the range.
import { bare } from "../net_http_server/taken"
import { HttpServerLimits } from "nish/net/http-server"

export const main = (): i32 => {
  const limits = new HttpServerLimits()
  limits.requests = 0
  bare(limits)
  console.log("FAIL  the call returned")
  return 0
}
