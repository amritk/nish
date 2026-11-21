// Trailers after a head that declared a body length of 0 panic: that head
// ended the stream.
import { ascii, ZERO } from "../net_tls_record_common/bytes"
import { TakenH2c } from "../net_http_server/taken-h2c"

export const main = (): i32 => {
  const t = new TakenH2c("/")
  const none: u8[][] = []
  t.h.start(t.req, 200, none, none, ZERO)
  t.h.trailers(t.req, [ascii("grpc-status")], [ascii("0")])
  console.log("FAIL  the call returned")
  return 0
}
