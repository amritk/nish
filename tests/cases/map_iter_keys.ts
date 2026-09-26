// WP32 (docs/wp32-map.md §6.2): `for (const k of m.keys())` walks the keys in
// insertion order. A deleted key is skipped, a key set again keeps its place,
// and a key deleted and then set again goes to the end, as in JavaScript.
export const main = (): i32 => {
  const m = new Map<string, number>();
  m.set("one", 1).set("two", 2).set("three", 3).set("four", 4);
  m.delete("two");
  m.set("one", 10);
  m.delete("three");
  m.set("three", 30);
  for (const k of m.keys()) {
    console.log(k);
  }
  return 0;
};
