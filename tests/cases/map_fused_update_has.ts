// WP32 S5 (docs/wp32-map.md §9.1, pattern 1): the one read inside the value
// may be a `has` as well as a `get`. `m.set(k, m.has(k) ? 2 : 1)` is one probe,
// and the `has` is its found bit, with no call of its own.
const mark = (m: Map<i32, number>, k: i32): void => {
  m.set(k, m.has(k) ? 2 : 1);
};

export const main = (): i32 => {
  const m = new Map<i32, number>();
  mark(m, 7);
  mark(m, 3);
  mark(m, 7);
  for (const k of m.keys()) {
    console.log(`${k} ${m.get(k) ?? -1}`);
  }
  return 0;
};
