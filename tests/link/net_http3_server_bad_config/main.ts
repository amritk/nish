// An `Http3Server` is sized when it is made, and a pool of no slots cannot
// serve anyone: it is the program's mistake and panics, with
//
//     Http3Server: 0 slots, outside 1 to 65536
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { udpBind } from "nish:net";
import { QUIC_LISTENER_ENTROPY_SIZE } from "nish/net/quic-listener";
import { Http3Server } from "nish/net/http3-server";
import { h3Config, H3Limits, h3QuicConfig } from "../net_http3/peer";

export const main = (): i32 => {
  const fd: i32 = udpBind("127.0.0.1", 0, 0);
  const entropy: u8[] = new Array<u8>(QUIC_LISTENER_ENTROPY_SIZE);
  console.log(`one slot: ${new Http3Server(h3QuicConfig(new H3Limits()), h3Config(), fd, 1, entropy).size()}`);
  console.log(`unreachable: ${new Http3Server(h3QuicConfig(new H3Limits()), h3Config(), fd, 0, entropy).size()}`);
  return 0;
};
