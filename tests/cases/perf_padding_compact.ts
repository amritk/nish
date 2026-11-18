// WP48, NL9010: the padding warning measures a link of a compact class as the
// four-byte offset `computeLayout` gives it, not an eight-byte pointer.
//
// `Spill` is 24 bytes: the link takes four, four are thrown away reaching the
// `f64`, and the trailing `i32` rounds the whole thing up to eight. With the
// `f64` first, the link and the `i32` share one eight-byte word and it is 16.
// Measured as a pointer the link would be eight bytes wide, that order would
// also come to 24, and the warning would say nothing.
//
// `Pair` is an `i32` and two links, 12 bytes with no gap in any order, and
// stays quiet.
import { Compact } from "nish:compact";

export class Spill implements Compact {
  next: Spill | null = null;
  weight: f64 = 0;
  count: i32 = 0;
}

export class Pair implements Compact {
  value: i32 = 0;
  left: Pair | null = null;
  right: Pair | null = null;
}

export const test = (): number => {
  const s = new Spill();
  s.count = 7;
  s.next = new Spill();
  const p = new Pair();
  p.value = 3;
  p.left = new Pair();
  const next = s.next;
  return s.count + p.value + (next === null ? 0 : 1) + (p.left === null ? 0 : 1);
};
