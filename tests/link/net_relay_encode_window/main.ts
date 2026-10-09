// An encoder's payload window outside its buffer is the program's mistake, and panics with
//
//     relayEncodeData: the window [2, 2 + 3) is outside a buffer of 4 bytes
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { relayEncodeData } from "../../../examples/relay/frame";
import { n32 } from "../net_quic_frame/typed";

export const main = (): i32 => {
  console.log("a DATA payload from a window past its buffer");
  const out: u8[] = new Array<u8>(64);
  const payload: u8[] = new Array<u8>(4);
  console.log(`unreachable: ${relayEncodeData(out, n32(0), n32(1), payload, n32(2), n32(3))}`);
  return 0;
};
