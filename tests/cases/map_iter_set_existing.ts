// WP32 (docs/wp32-map.md §6.2, second row): a key set again during a walk has
// its value written in place: the walk sees the new value if it has not yet
// reached the key, and the key keeps its place either way.
export const main = (): i32 => {
  const m = new Map<string, number>();
  m.set("a", 1).set("b", 2).set("c", 3);
  for (const v of m.values()) {
    console.log(`${v}`);
    if (v === 2) {
      m.set("c", 30);
      m.set("a", 10);
    }
  }
  for (const k of m.keys()) {
    console.log(k);
  }
  return 0;
};
