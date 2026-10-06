// `RelayPeers` is sized at start-up, and a table of no rows could hold no address, and panics with
//
//     RelayPeers: 0 rows, outside 1 to 1048576
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { RelayPeers } from "../../../examples/relay/peers";
import { n32 } from "../net_quic_frame/typed";

export const main = (): i32 => {
  console.log("a per-peer table of no rows");
  const peers = new RelayPeers(n32(0), new Array<u8>(8));
  console.log(`unreachable: ${peers.used}`);
  return 0;
};
