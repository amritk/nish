// Field names and values of different counts panic.
import { Taken } from "../net_http_server/taken"
import { ascii, ZERO } from "../net_tls_record_common/bytes"

export const main = (): i32 => {
  const t = new Taken("/")
  const names: u8[][] = [ascii("x-one")]
  const values: u8[][] = []
  t.h.start(t.req, 200, names, values, ZERO)
  console.log("FAIL  the call returned")
  return 0
}
