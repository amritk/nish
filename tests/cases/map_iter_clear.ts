// WP32 (docs/wp32-map.md §6.1, §6.2, fifth row): `clear` during a walk ends
// what the walk has left to visit, and a key set after the `clear` is visited
// by the same walk, as JavaScript's is.
export const main = (): i32 => {
  const m = new Map<string, number>();
  m.set("a", 1).set("b", 2).set("c", 3);
  for (const k of m.keys()) {
    console.log(k);
    if (k === "a") {
      m.clear();
      console.log(`cleared ${m.size}`);
      m.set("n", 9);
    }
  }
  console.log(`size ${m.size} ${m.has("n")} ${m.has("b")}`);
  for (const v of m.values()) {
    console.log(`${v}`);
  }
  return 0;
};
