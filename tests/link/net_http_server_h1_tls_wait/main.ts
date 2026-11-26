// `wait` on a server with an HTTP/1.1 over TLS listener panics: a handshake
// needs the certificate's key, which only `waitSigned` takes.
import { bare } from "../net_http_server/taken"
import { HttpServerLimits } from "nish/net/http-server"
import { H1_ALPN, Http1Config } from "nish/net/http1-server"
import { tcpListen } from "nish:net"
import { tcpConfig } from "../net_tls_common/server"

export const main = (): i32 => {
  const h = bare(new HttpServerLimits())
  h.listenHttp1Tls(tcpListen("127.0.0.1", 0, 8), tcpConfig([H1_ALPN]), new Http1Config(), 4)
  h.wait(1)
  console.log("FAIL  the call returned")
  return 0
}
