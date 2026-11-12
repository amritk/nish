// An HTTP/2 over TLS listener with no connection slot panics.
import { bare } from "../net_http_server/taken"
import { HttpServerLimits } from "nish/net/http-server"
import { Http2Config } from "nish/net/http2"
import { H2_ALPN } from "nish/net/http2-tls"
import { tcpListen } from "nish:net"
import { tcpConfig } from "../net_tls_common/server"

export const main = (): i32 => {
  const h = bare(new HttpServerLimits())
  h.listenHttp2Tls(tcpListen("127.0.0.1", 0, 8), tcpConfig([H2_ALPN]), new Http2Config(), 0)
  console.log("FAIL  the call returned")
  return 0
}
