// A second `listenH2c` on one server panics: a server has one h2c listener.
import { bare } from "../net_http_server/taken"
import { HttpServerLimits } from "nish/net/http-server"
import { Http2Config } from "nish/net/http2"
import { tcpListen } from "nish:net"

export const main = (): i32 => {
  const h = bare(new HttpServerLimits())
  h.listenH2c(tcpListen("127.0.0.1", 0, 8), new Http2Config(), 4)
  h.listenH2c(tcpListen("127.0.0.1", 0, 8), new Http2Config(), 4)
  console.log("FAIL  the second call returned")
  return 0
}
