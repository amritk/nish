// Trailers before `start` panic: there is no head for them to follow.
import { ascii } from "../net_tls_record_common/bytes"
import { TakenH2c } from "../net_http_server/taken-h2c"

export const main = (): i32 => {
  const t = new TakenH2c("/")
  t.h.trailers(t.req, [ascii("grpc-status")], [ascii("0")])
  console.log("FAIL  the call returned")
  return 0
}
