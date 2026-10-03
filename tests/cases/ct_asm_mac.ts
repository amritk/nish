// WP34 N6: the two loops crypto code is built from, over u8[] and u32[] whose
// contents are secret. The trip counts are constants and the indexing is
// unchecked (`uncheckedGet` from `nish:unsafe`), so the only loads are at
// public offsets and the assembly check in tests/run.js can hold both to "no
// branch at all".
// ct-check: macEqual secret=contents
// ct-check: tableLookup secret=secret,contents

import { uncheckedGet } from "nish:unsafe";

// A 32-byte tag compared in full: every pair is read whatever the earlier ones
// held, and the one answer is a mask rather than a boolean a caller would
// branch on.
export const macEqual = (a: u8[], b: u8[]): u32 => {
  let diff: u32 = 0;
  for (let i: i32 = 0; i < 32; i++) {
    diff = diff | toU32(uncheckedGet(a, i) ^ uncheckedGet(b, i));
  }
  return ctEq(diff, 0);
};

// A table read at a secret index without indexing by it: every entry is loaded,
// and the one that matches is kept by a mask.
export const tableLookup = (table: u32[], secret: u32): u32 => {
  let found: u32 = 0;
  for (let i: i32 = 0; i < 8; i++) {
    found = found | ctSelect(ctEq(toU32(i), secret), uncheckedGet(table, i), 0);
  }
  return found;
};
