// WebTransport is not served: a configuration that offers sessions panics.
import { bare } from "../net_http_server/taken"
import { HttpServerLimits } from "nish/net/http-server"
import { udpBind } from "nish:net"
import { QUIC_LISTENER_ENTROPY_SIZE } from "nish/net/quic-listener"
import { h3Config, H3Limits, h3QuicConfig } from "../net_http3/peer"

export const main = (): i32 => {
  const h = bare(new HttpServerLimits())
  const entropy: u8[] = new Array<u8>(QUIC_LISTENER_ENTROPY_SIZE)
  const config = h3Config()
  config.webtransportSessions = 1
  h.listenHttp3(udpBind("127.0.0.1", 0, 0), h3QuicConfig(new H3Limits()), config, 1, entropy)
  console.log("FAIL  the call returned")
  return 0
}
