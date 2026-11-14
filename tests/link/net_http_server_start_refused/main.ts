// A field the HTTP/1.1 carrier refuses panics: here a name that is not a token.
import { Taken } from "../net_http_server/taken"
import { ascii, ZERO } from "../net_tls_record_common/bytes"

export const main = (): i32 => {
  const t = new Taken("/")
  const names: u8[][] = [ascii("bad name")]
  const values: u8[][] = [ascii("x")]
  t.h.start(t.req, 200, names, values, ZERO)
  console.log("FAIL  the call returned")
  return 0
}
