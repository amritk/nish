// `Http3Server` refuses a `headTimeout` below one millisecond when it is
// made, before any slot's connection is built: with none, its clock would
// close every client at once, and a negative one would never close one at
// all. A server of one-millisecond timeouts is made, and one of
// `headTimeout` -1 panics in its constructor, on stderr, with
//
//     Http3Server: headTimeout of -1, outside 1 to 2147483647
//
// and exits 1. `expected.stderr` pins the message.
import { udpBind } from "nish:net";
import { QUIC_LISTENER_ENTROPY_SIZE } from "nish/net/quic-listener";
import { Http3Server } from "nish/net/http3-server";
import { h3Config, H3Limits, h3QuicConfig } from "../net_http3/peer";

export const main = (): i32 => {
  const fd: i32 = udpBind("127.0.0.1", 0, 0);
  const entropy: u8[] = new Array<u8>(QUIC_LISTENER_ENTROPY_SIZE);
  const config = h3Config();
  config.idleTimeout = 1;
  config.headTimeout = 1;
  console.log(`one-millisecond timeouts make a server of ${new Http3Server(h3QuicConfig(new H3Limits()), config, fd, 4, entropy).size()} slots`);
  config.headTimeout = -1;
  console.log(`unreachable: ${new Http3Server(h3QuicConfig(new H3Limits()), config, fd, 4, entropy).size()}`);
  return 0;
};
