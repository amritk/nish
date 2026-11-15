// A status outside 200 to 599 panics.
import { Taken } from "../net_http_server/taken"

export const main = (): i32 => {
  const t = new Taken("/")
  t.h.empty(t.req, 199)
  console.log("FAIL  the call returned")
  return 0
}
