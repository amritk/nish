// A derivation into a held `Secret` writes its destination in place, so the
// destination has to be a `Secret`: a plain array would leave the derived key
// where nothing wipes it.
import { hkdfExpandLabelSha256Held } from "nish/crypto/hkdf";
import { Secret, secret, wipe } from "nish:secret";
const bytes = (n: i32, b: u8): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < n; k++) {
    out.push(b);
  }
  return out;
};
export const main = (): i32 => {
  const prk: Secret<u8[]> = secret(bytes(32, 7));
  const dst: u8[] = bytes(32, 0);
  hkdfExpandLabelSha256Held(dst, prk, "key", []);
  wipe(prk);
  return toI32(dst[0]);
};
