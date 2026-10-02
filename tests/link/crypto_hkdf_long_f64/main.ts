// HKDF-Expand with an `info` longer than 2^31 - 1 bytes answers `null`, as a
// length past 255 × HashLen does. Under `--number-mode f64` `toI32` of such a
// length saturates, so it used to MAC only the first 2^31 - 1 bytes of
// `info`, and two contexts that shared them derived one key.
// docs/security/crypto-k1.md, finding K1-4.
import { hkdfExpandSha256, hkdfExpandSha384 } from "nish/crypto/hkdf";
import { Suite } from "nish/testing";

export const main = (): i32 => {
  const t = new Suite("hkdf long");
  const n: number = 2147483648;
  const info: u8[] = new Array<u8>(n);
  const prk: u8[] = new Array<u8>(48);
  const len: i32 = toI32(32);
  t.ok("hkdfExpandSha256: a 2^31-byte info answers null", hkdfExpandSha256(prk, info, len) === null);
  t.ok("hkdfExpandSha384: a 2^31-byte info answers null", hkdfExpandSha384(prk, info, len) === null);
  return t.done();
};
