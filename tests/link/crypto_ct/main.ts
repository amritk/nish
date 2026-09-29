// `nish/crypto/ct` by its answers. A timing test would be a flaky one, so what
// is pinned here is what the functions *say*: equal means every byte, a single
// flipped bit anywhere is seen, unequal lengths are refused, and a window that
// leaves its array answers `false` rather than panicking on the read — the
// decision the module comment gives the reason for.
import { timingSafeEqual, timingSafeEqualAt } from "nish/crypto/ct";
import { Suite } from "nish/testing";

/** A 32-byte buffer that is not all one value, the size of an HMAC-SHA-256 tag. */
const ctPattern = (): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < 32; i++) {
    out.push(toU8((i * 37 + 11) & 255));
  }
  return out;
};

export const main = (): number => {
  const t = new Suite("ct");

  // --- timingSafeEqual ---------------------------------------------------------
  t.eqBool("equal: two copies of one tag", timingSafeEqual(ctPattern(), ctPattern()), true);
  t.eqBool("equal: two empty arrays", timingSafeEqual([], []), true);
  t.eqBool("equal: one byte", timingSafeEqual([toU8(0)], [toU8(0)]), true);
  t.eqBool("equal: 0xff against 0xff", timingSafeEqual([toU8(255)], [toU8(255)]), true);

  // Every single-bit difference, at every position, is seen: a comparison
  // that stopped reading early, or dropped a bit of the XOR, would miss one.
  let missed: i32 = 0;
  for (let at: i32 = 0; at < 32; at++) {
    for (let bit: i32 = 0; bit < 8; bit++) {
      const other: u8[] = ctPattern();
      other[at] = toU8(toI32(other[at]) ^ (1 << bit));
      if (timingSafeEqual(ctPattern(), other) || timingSafeEqual(other, ctPattern())) {
        missed++;
      }
    }
  }
  t.eqI32("unequal: each of the 256 single-bit flips is seen, both ways round", missed, 0);

  // A prefix is not equal: the lengths are compared before any byte is.
  const prefix: u8[] = ctPattern();
  prefix.pop();
  t.eqBool("unequal lengths: a 31-byte prefix of a 32-byte tag", timingSafeEqual(prefix, ctPattern()), false);
  t.eqBool("unequal lengths: the other way round", timingSafeEqual(ctPattern(), prefix), false);
  t.eqBool("unequal lengths: empty against one byte", timingSafeEqual([], [toU8(0)]), false);

  // --- timingSafeEqualAt -------------------------------------------------------
  // `wide` holds the pattern at offset 3; `ctPattern()` holds it at 0.
  const wide: u8[] = [toU8(1), toU8(2), toU8(3)];
  for (const b of ctPattern()) {
    wide.push(b);
  }
  wide.push(toU8(9));
  t.eqBool("window: the same 32 bytes at offsets 3 and 0", timingSafeEqualAt(wide, 3, ctPattern(), 0, 32), true);
  t.eqBool("window: a sub-window of both", timingSafeEqualAt(wide, 10, ctPattern(), 7, 20), true);
  t.eqBool("window: shifted by one is unequal", timingSafeEqualAt(wide, 4, ctPattern(), 0, 32), false);
  const flipped: u8[] = ctPattern();
  flipped[31] = toU8(toI32(flipped[31]) ^ 128);
  t.eqBool("window: a flip in the last byte of the window", timingSafeEqualAt(wide, 3, flipped, 0, 32), false);
  t.eqBool("window: a flip just past the window is not read", timingSafeEqualAt(wide, 3, flipped, 0, 31), true);
  t.eqBool("window: an empty window is equal", timingSafeEqualAt(wide, 0, flipped, 5, 0), true);
  t.eqBool("window: an empty window at the very end is in range", timingSafeEqualAt(wide, 36, flipped, 32, 0), true);

  // Out of range answers `false`; each of these would panic as a plain read.
  t.eqBool("out of range: a negative first offset", timingSafeEqualAt(wide, -1, wide, 0, 1), false);
  t.eqBool("out of range: a negative second offset", timingSafeEqualAt(wide, 0, wide, -1, 1), false);
  t.eqBool("out of range: a negative length", timingSafeEqualAt(wide, 0, wide, 0, -1), false);
  t.eqBool("out of range: the first window runs past its end", timingSafeEqualAt(wide, 30, flipped, 0, 7), false);
  t.eqBool("out of range: the second window runs past its end", timingSafeEqualAt(flipped, 0, wide, 30, 7), false);
  t.eqBool("out of range: an empty window past the end", timingSafeEqualAt(wide, 37, flipped, 0, 0), false);
  // `off + len` would wrap to a negative sum here; the check must not.
  t.eqBool(
    "out of range: an offset near the i32 maximum does not wrap",
    timingSafeEqualAt(wide, 2147483647, flipped, 0, 1),
    false
  );
  t.eqBool(
    "out of range: a length near the i32 maximum does not wrap",
    timingSafeEqualAt(wide, 1, flipped, 1, 2147483647),
    false
  );
  t.eqBool("out of range: a window of an empty array", timingSafeEqualAt([], 0, wide, 0, 1), false);

  return t.done();
};
