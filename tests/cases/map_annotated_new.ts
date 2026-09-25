// WP32 (docs/wp32-map.md §7): `new Map()` takes its type arguments from the
// annotation of the declaration it initialises, as `tsc` infers them there.
export const main = (): i32 => {
  const m: Map<string, i32> = new Map();
  let s: Set<i32> = new Set();
  m.set("one", 1);
  s.add(1).add(2);
  console.log(`${m.size} ${s.size} ${m.has("one")}`);
  return 0;
};
