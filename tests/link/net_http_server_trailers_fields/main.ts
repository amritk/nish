// A trailer name that is not lowercase panics: the HTTP/2 carrier refuses it.
import { HTTP1_CHUNKED } from "nish/net/http1-codec"
import { ascii } from "../net_tls_record_common/bytes"
import { TakenH2c } from "../net_http_server/taken-h2c"

export const main = (): i32 => {
  const t = new TakenH2c("/")
  const none: u8[][] = []
  t.h.start(t.req, 200, none, none, HTTP1_CHUNKED)
  t.h.trailers(t.req, [ascii("Grpc-Status")], [ascii("0")])
  console.log("FAIL  the call returned")
  return 0
}
