// `sendJson` with no value begun by `json()` panics rather than send what
// the writer last held.
import { Taken } from "../net_http_server/taken"

export const main = (): i32 => {
  const t = new Taken("/")
  t.h.sendJson(t.req, 200)
  console.log("FAIL  the call returned")
  return 0
}
