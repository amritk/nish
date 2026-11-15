// Ending a response never started panics.
import { Taken } from "../net_http_server/taken"

export const main = (): i32 => {
  const t = new Taken("/")
  t.h.end(t.req)
  console.log("FAIL  the call returned")
  return 0
}
