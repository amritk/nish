// A hasher is spent once it has answered its digest: a later `update` would
// hash onto a state that padding has already closed, so it panics (exit 1)
// rather than answer a digest of nothing in particular.
import { Sha384 } from "nish/crypto/sha512";

export const main = (): i32 => {
  const data: u8[] = [0x61, 0x62, 0x63];
  const h = new Sha384();
  h.update(data, 0, 3);
  console.log(`digest: ${h.digest().length} bytes`);
  h.update(data, 0, 3);
  console.log("unreachable: update after digest was accepted");
  return 0;
};
