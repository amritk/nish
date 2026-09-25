// WP32 (docs/wp32-map.md §2.3, acceptance criterion 4): a probe reads the entry
// list only on a fingerprint match, and compares the stored full hash before
// the key. So 10000 lookups of absent string keys compare no key at all, and
// 10000 lookups of present ones compare exactly one key each.
//
// `tests/run.js` links this with `-Wl,--wrap=nish_str_eq` and
// `map_fingerprint_miss.c`, whose wrapper counts every key compare and answers
// the count through `mapKeyCompares`. The IR golden pins the one call site.
declare function mapKeyCompares(): i32;

export const main = (): i32 => {
  const m = new Map<string, i32>();
  const n: i32 = 10000;
  for (let i: i32 = 0; i < n; i++) {
    m.set(`present${i}`, i);
  }
  const before = mapKeyCompares();
  let misses: i32 = 0;
  for (let i: i32 = 0; i < n; i++) {
    if (!m.has(`absent${i}`)) {
      misses++;
    }
  }
  const afterMisses = mapKeyCompares();
  let hits: i32 = 0;
  for (let i: i32 = 0; i < n; i++) {
    if (m.has(`present${i}`)) {
      hits++;
    }
  }
  const afterHits = mapKeyCompares();
  console.log(`misses ${misses}: ${afterMisses - before} key compares`);
  console.log(`hits ${hits}: ${afterHits - afterMisses} key compares`);
  return 0;
};
