// `GrantVerifier.verify` never panics on a token, but a window outside its buffer is the caller's mistake, and panics with
//
//     GrantVerifier.verify: the window [0, 0 + 5) is outside a buffer of 4 bytes
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { Secret, secret, wipe } from "nish:secret";
import { GrantVerifier, RelayGrant } from "../../../examples/relay/grant";
import { n32, n64 } from "../net_quic_frame/typed";

export const main = (): i32 => {
  console.log("a token read from a window past its buffer");
  const buf: u8[] = new Array<u8>(4);
  const v = new GrantVerifier();
  const key: Secret<u8[]> = secret([toU8(1)]);
  console.log(`unreachable: ${v.verify(buf, n32(0), n32(5), n64(0), key, new RelayGrant())}`);
  wipe(key);
  return 0;
};
