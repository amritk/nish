// WP32 S5 (docs/wp32-map.md §9.1, §6.2): a fused update and a fused insert
// inside a walk of the table they write behave exactly as the separate calls
// do. A key the update inserts is appended past the cursor and visited, and one
// it updates is written in place; the walk defers compaction, which the fused
// `insertAt` respects as `set`'s own insert does.
export const main = (): i32 => {
  const m = new Map<number, number>();
  m.set(1, 0);
  m.set(2, 0);
  for (const k of m.keys()) {
    const next = k * 2;
    if (next < 10) {
      m.set(next, (m.get(next) ?? 0) + 1);
    }
  }
  for (const k of m.keys()) {
    console.log(`${k} ${m.get(k) ?? -1}`);
  }
  const s = new Set<number>();
  s.add(3);
  let added = 0;
  for (const x of s) {
    const y = x + 3;
    if (!s.has(y)) {
      s.add(y);
      added = added + 1;
    }
    if (s.size > 5) {
      break;
    }
  }
  console.log(`${s.size} ${added}`);
  return 0;
};
