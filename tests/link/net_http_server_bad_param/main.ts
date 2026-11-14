// Reading a route parameter the route does not have panics rather than read
// past the parameters `Router.match` gave.
import { Taken } from "../net_http_server/taken"

export const main = (): i32 => {
  const t = new Taken("/")
  t.req.paramDecimal(0)
  console.log("FAIL  the call returned")
  return 0
}
