// A frame's window outside its buffer is the program's mistake, not the peer's, and panics with
//
//     relayDecode: the window [4, 4 + 5) is outside a buffer of 8 bytes
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { RelayFrame, relayDecode } from "../../../examples/relay/frame";
import { n32 } from "../net_quic_frame/typed";

export const main = (): i32 => {
  console.log("a frame decoded from a window past its buffer");
  const buf: u8[] = new Array<u8>(8);
  console.log(`unreachable: ${relayDecode(new RelayFrame(), buf, n32(4), n32(5))}`);
  return 0;
};
