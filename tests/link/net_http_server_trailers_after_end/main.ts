// Trailers after `end` panic: `end` already closed the answer, so there is
// no stream left for a trailer section to end.
import { ascii } from "../net_tls_record_common/bytes"
import { TakenH2c } from "../net_http_server/taken-h2c"
import { HTTP1_CHUNKED } from "nish/net/http1-codec"

export const main = (): i32 => {
  const t = new TakenH2c("/")
  const none: u8[][] = []
  t.h.start(t.req, 200, none, none, HTTP1_CHUNKED)
  t.h.end(t.req)
  t.h.trailers(t.req, [ascii("grpc-status")], [ascii("0")])
  console.log("FAIL  the call returned")
  return 0
}
