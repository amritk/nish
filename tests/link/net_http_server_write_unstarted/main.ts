// Writing a body before `start` panics.
import { Taken } from "../net_http_server/taken"
import { ascii, ZERO } from "../net_tls_record_common/bytes"

export const main = (): i32 => {
  const t = new Taken("/")
  const body: u8[] = ascii("x")
  t.h.write(t.req, body, ZERO, 1)
  console.log("FAIL  the call returned")
  return 0
}
