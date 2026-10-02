// `timingSafeEqual` on arrays longer than 2^31 - 1 bytes, under
// `--number-mode f64`, where a length is exact but `toI32` of it saturates.
// The compare used to take both lengths through `toI32` first, so a 2^31-byte
// array and a (2^31 - 1)-byte one looked the same length, only the first
// 2^31 - 1 bytes were read, and the answer was "equal". Now the lengths are
// compared as numbers, and an array no `i32` index can reach the end of
// answers `false`. docs/security/crypto-k1.md, finding K1-2.
//
// `timingSafeEqualAt` needs no such check, and the last line pins why: its
// windows are `i32`s, so a window that fits under the saturated length is
// inside the real array. Nothing here reads the arrays through, so the check
// costs their allocation and not a 2 GiB compare.
import { timingSafeEqual, timingSafeEqualAt } from "nish/crypto/ct";
import { Suite } from "nish/testing";

export const main = (): i32 => {
  const t = new Suite("ct long");
  const n: number = 2147483648;
  const long: u8[] = new Array<u8>(n);
  const shorter: u8[] = new Array<u8>(n - 1);
  t.eqBool("2^31 bytes against 2^31 - 1: unequal lengths", timingSafeEqual(long, shorter), false);
  t.eqBool("2^31 - 1 bytes against 2^31: unequal lengths", timingSafeEqual(shorter, long), false);
  t.eqBool("2^31 bytes against itself: past what a compare can read", timingSafeEqual(long, long), false);
  long[n - 2] = toU8(7);
  t.eqBool(
    "a window ending at 2^31 - 1, inside a 2^31-byte array",
    timingSafeEqualAt(long, toI32(n - 4), [toU8(0), toU8(0), toU8(7)], toI32(0), toI32(3)),
    true
  );
  return t.done();
};
