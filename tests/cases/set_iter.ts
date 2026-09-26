// WP32 (docs/wp32-map.md §6.3): `for (const x of s)` walks a `Set` in
// insertion order, which is `s.values()`; a deleted element is skipped and one
// added again goes to the end.
export const main = (): i32 => {
  const s = new Set<string>();
  s.add("red").add("green").add("blue").add("red");
  s.delete("green");
  s.add("green");
  for (const x of s) {
    console.log(x);
  }
  return 0;
};
