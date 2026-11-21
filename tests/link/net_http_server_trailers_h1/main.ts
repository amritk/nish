// Trailers on an HTTP/1.1 response panic: the façade sends them on HTTP/2 only.
import { HTTP1_CHUNKED } from "nish/net/http1-codec"
import { ascii } from "../net_tls_record_common/bytes"
import { Taken } from "../net_http_server/taken"

export const main = (): i32 => {
  const t = new Taken("/")
  const none: u8[][] = []
  t.h.start(t.req, 200, none, none, HTTP1_CHUNKED)
  t.h.trailers(t.req, [ascii("grpc-status")], [ascii("0")])
  console.log("FAIL  the call returned")
  return 0
}
