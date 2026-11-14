// A write window outside its buffer panics.
import { Taken } from "../net_http_server/taken"
import { ascii, ZERO } from "../net_tls_record_common/bytes"

export const main = (): i32 => {
  const t = new Taken("/")
  const none: u8[][] = []
  t.h.start(t.req, 200, none, none, 4)
  const body: u8[] = ascii("ab")
  t.h.write(t.req, body, 1, 2)
  console.log("FAIL  the call returned")
  return 0
}
