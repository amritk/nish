// WP32 (docs/wp32-map.md §6.2, sixth row): inserts during a walk that grow the
// table many times over move the buckets and not the entries, so the walk goes
// on in insertion order and visits every key added, the new ones included.
export const main = (): i32 => {
  const m = new Map<number, number>();
  m.set(0, 0);
  let visited = 0;
  let sum = 0;
  for (const k of m.keys()) {
    visited++;
    sum += k;
    if (k < 999) {
      m.set(k + 1, k);
    }
  }
  console.log(`visited ${visited} sum ${sum} size ${m.size}`);
  return 0;
};
