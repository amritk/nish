// `listenH2c` makes its checks, then panics: h2c is not served yet.
import { bare } from "../net_http_server/taken"
import { HttpServerLimits } from "nish/net/http-server"
import { Http2Config } from "nish/net/http2"
import { tcpListen } from "nish:net"

export const main = (): i32 => {
  const h = bare(new HttpServerLimits())
  h.listenH2c(tcpListen("127.0.0.1", 0, 8), new Http2Config(), 4)
  console.log("FAIL  the call returned")
  return 0
}
