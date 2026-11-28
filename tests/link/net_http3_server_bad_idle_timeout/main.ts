// `openHttp3Server` refuses a `idleTimeout` below one millisecond before it
// builds the server, as an `Err`: with none, its clock would close every
// client at once, and a negative one would never close one at all. A server
// of one-millisecond timeouts opens, and one of `idleTimeout` 0 answers
//
//     Http3Server: idleTimeout of 0, outside 1 to 2147483647
//
// The constructor leaves the check to each slot's `Http3Connection`, built at
// the slot's first Initial.
import { udpBind } from "nish:net";
import { QUIC_LISTENER_ENTROPY_SIZE } from "nish/net/quic-listener";
import { openHttp3Server } from "nish/net/http3-server";
import { h3Config, H3Limits, h3QuicConfig } from "../net_http3/peer";

export const main = (): i32 => {
  const fd: i32 = udpBind("127.0.0.1", 0, 0);
  const entropy: u8[] = new Array<u8>(QUIC_LISTENER_ENTROPY_SIZE);
  const config = h3Config();
  config.idleTimeout = 1;
  config.headTimeout = 1;
  const good = openHttp3Server(h3QuicConfig(new H3Limits()), config, fd, 4, entropy);
  console.log(`one-millisecond timeouts make a server of ${good.ok ? good.value.size() : -1} slots`);
  config.idleTimeout = 0;
  const bad = openHttp3Server(h3QuicConfig(new H3Limits()), config, fd, 4, entropy);
  console.log(bad.ok ? "opened" : `Err: ${bad.error}`);
  const none = openHttp3Server(h3QuicConfig(new H3Limits()), h3Config(), fd, 0, entropy);
  console.log(none.ok ? "opened" : `Err: ${none.error}`);
  const wide = openHttp3Server(h3QuicConfig(new H3Limits()), h3Config(), fd, 65537, entropy);
  console.log(wide.ok ? "opened" : `Err: ${wide.error}`);
  return 0;
};
