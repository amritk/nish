// `Sha256.digest` pads the message in the hasher's own block and folds that
// padding into the hash value, so a second `digest` would pad an already
// padded message and answer a digest of nothing the caller sent. It panics
// instead ("Sha256: digest called twice", on stderr): exit 1, and stdout stops
// at the line printed after the first digest. The link harness compares
// stdout and the exit code only, so the message is named here rather than
// pinned. A caller that needs a digest and more input takes a `copy()` first.
import { Sha256 } from "nish/crypto/sha256";

export const main = (): i32 => {
  const data: u8[] = [97, 98, 99];
  const start: i32 = 0;
  const h: Sha256 = new Sha256();
  h.update(data, start, toI32(data.length));
  console.log(`first digest: ${toI32(h.digest().length)} bytes`);
  const again: u8[] = h.digest();
  console.log(`unreachable: a second digest answered ${toI32(again.length)} bytes`);
  return 0;
};
