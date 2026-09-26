// WP32 S5 (docs/wp32-map.md §9.2, §6.2): `getOrInsert` and `reserve` inside a
// walk of the table they touch. `getOrInsert` of a missing key appends it past
// the cursor, and the walk visits it, as JavaScript's does; `reserve` only
// grows the buckets, which moves no entry, so it is safe under a walk.
import { getOrInsert, reserve } from "nish/map";

export const main = (): i32 => {
  const m = new Map<string, number>();
  m.set("a", 1);
  for (const k of m.keys()) {
    reserve(m, 64);
    const v = m.get(k) ?? 0;
    if (v < 4) {
      const got = getOrInsert(m, `${k}+`, v + 1);
      console.log(`${k} -> ${got}`);
    }
    console.log(`${k} ${getOrInsert(m, k, 100)}`);
  }
  console.log(`${m.size}`);
  return 0;
};
