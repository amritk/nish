// The two HTTP/1.1 listeners share the poll tokens below HTTP/2's: a TLS
// listener whose slots would take the cleartext one's past 1048576 panics.
import { bare } from "../net_http_server/taken"
import { HttpServerLimits } from "nish/net/http-server"
import { H1_ALPN, Http1Config } from "nish/net/http1-server"
import { tcpListen } from "nish:net"
import { tcpConfig } from "../net_tls_common/server"

export const main = (): i32 => {
  const h = bare(new HttpServerLimits())
  h.listenHttp1(tcpListen("127.0.0.1", 0, 8), new Http1Config(), 1048576)
  h.listenHttp1Tls(tcpListen("127.0.0.1", 0, 8), tcpConfig([H1_ALPN]), new Http1Config(), 1)
  console.log("FAIL  the call returned")
  return 0
}
