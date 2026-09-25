// WP32 (docs/wp32-map.md §6.3): a `Set` is the table without values, with the
// same probe. `add` returns the set, so it chains, and adding a present
// element changes nothing.
export const main = (): i32 => {
  const s = new Set<string>();
  s.add("red").add("green").add("red");
  const had = s.has("green") && !s.has("blue");
  const gone = s.delete("red");
  console.log(`${s.size} ${had} ${gone} ${s.delete("red")} ${s.has("red")}`);
  s.clear();
  console.log(`${s.size} ${s.has("green")}`);
  return 0;
};
