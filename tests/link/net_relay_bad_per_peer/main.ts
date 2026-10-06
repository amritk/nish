// `RelayConfig.maxPerPeer` past `maxSessions` is a cap no address could reach: the relay panics when it is made, before any slot is, with
//
//     Relay: maxPerPeer of 4097, outside 1 to 4096
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { udpBind } from "nish:net";
import { QUIC_LISTENER_ENTROPY_SIZE } from "nish/net/quic-listener";
import { RelayConfig } from "../../../examples/relay/relay";
import { n32 } from "../net_quic_frame/typed";
import { rigRelay } from "../net_relay/rig";

export const main = (): i32 => {
  const fd: i32 = udpBind("127.0.0.1", n32(0), n32(0));
  const config = new RelayConfig();
  config.verbose = false;
  config.maxPerPeer = 4097;
  console.log("a relay with maxPerPeer out of range");
  const relay = rigRelay(config, fd, new Array<u8>(QUIC_LISTENER_ENTROPY_SIZE));
  console.log(`unreachable: ${relay.size()}`);
  return 0;
};
