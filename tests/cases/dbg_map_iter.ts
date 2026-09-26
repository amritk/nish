// WP32 (docs/wp32-map.md §6.2): under `-g` the variable of a walk of a `Map`
// or a `Set` is described like any `for...of` variable, in the walk's slot.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  m.set("a", 1).set("b", 2);
  let sum: i32 = 0;
  for (const word of m.keys()) {
    sum += word.length;
  }
  for (const count of m.values()) {
    sum += count;
  }
  console.log(`${sum}`);
  return 0;
};
