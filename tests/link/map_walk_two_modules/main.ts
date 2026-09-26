// WP32 (docs/wp32-map.md §4.1, §6.2): the walks are all in the other module.
// This one only fills the tables, so the walk methods `expected.ir` names can
// only have come from `walker.ll`, which gets `internal` copies of its own:
// `walkOpen`, `walkNext`, `walkClose` and the reader, per table, and
// `nextLive`. The early `return` there closes its walk, so the churn after it
// here compacts rather than growing.
import { firstLong, total } from "./walker";

export const main = (): i32 => {
  const m = new Map<string, i32>();
  const s = new Set<string>();
  m.set("a", 10).set("bb", 20).set("ccc", 12);
  s.add("x").add("yyyy").add("zz");
  const long = firstLong(s, 3);
  for (let i: i32 = 0; i < 20000; i++) {
    s.add(`k${i}`);
    s.delete(`k${i}`);
  }
  console.log(`total ${total(m)} long ${long} size ${s.size}`);
  return 0;
};
