// `RelayJson.read` refuses every document it cannot read, but a window outside its buffer is the program's mistake, and panics with
//
//     RelayJson.read: the window [-1, -1 + 2) is outside a buffer of 2 bytes
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { RelayJson } from "../../../examples/relay/json";
import { n32 } from "../net_quic_frame/typed";

export const main = (): i32 => {
  console.log("a document read from a window past its buffer");
  const buf: u8[] = new Array<u8>(2);
  console.log(`unreachable: ${new RelayJson().read(buf, n32(-1), n32(2))}`);
  return 0;
};
