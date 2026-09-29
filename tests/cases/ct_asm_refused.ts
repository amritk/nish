// WP34 N6: two functions written to fail the assembly check in tests/run.js,
// one for each thing it refuses. A check that silently read nothing would pass
// everything; this fixture is how the suite knows it can fail.
// ct-check: naiveEqual secret=contents expect=branch
// ct-check: indexedLookup secret=secret expect=load

// The comparison `===` gives: it stops at the first differing byte, so its
// running time says how many leading bytes matched.
export const naiveEqual = (a: u8[], b: u8[]): u32 => {
  for (let i: i32 = 0; i < 32; i++) {
    if (a[i] !== b[i]) {
      return 0;
    }
  }
  return 0xffffffff;
};

// A table indexed by a secret: which cache line is read says which entry.
export const indexedLookup = (table: u32[], secret: u32): u32 => table[toI32(secret & 15)];
