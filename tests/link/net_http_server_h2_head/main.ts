// An HTTP/2 header list the configuration admits past `limits.maxHead`
// panics: the head is laid out in a request of that size.
import { bare } from "../net_http_server/taken"
import { HttpServerLimits } from "nish/net/http-server"
import { Http2Config } from "nish/net/http2"
import { H2_ALPN } from "nish/net/http2-tls"
import { tcpListen } from "nish:net"
import { tcpConfig } from "../net_tls_common/server"

export const main = (): i32 => {
  const limits = new HttpServerLimits()
  const config = new Http2Config()
  config.maxHeaderListSize = limits.maxHead + 1
  bare(limits).listenHttp2Tls(tcpListen("127.0.0.1", 0, 8), tcpConfig([H2_ALPN]), config, 4)
  console.log("FAIL  the call returned")
  return 0
}
