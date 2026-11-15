// An HTTP/3 field section the configuration admits past `limits.maxHead`
// panics: the head is laid out in a request of that size.
import { bare } from "../net_http_server/taken"
import { HttpServerLimits } from "nish/net/http-server"
import { udpBind } from "nish:net"
import { QUIC_LISTENER_ENTROPY_SIZE } from "nish/net/quic-listener"
import { h3Config, H3Limits, h3QuicConfig } from "../net_http3/peer"

export const main = (): i32 => {
  const limits = new HttpServerLimits()
  const entropy: u8[] = new Array<u8>(QUIC_LISTENER_ENTROPY_SIZE)
  const config = h3Config()
  config.maxFieldSectionSize = limits.maxHead + 1
  bare(limits).listenHttp3(udpBind("127.0.0.1", 0, 0), h3QuicConfig(new H3Limits()), config, 1, entropy)
  console.log("FAIL  the call returned")
  return 0
}
