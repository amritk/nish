// WP32 (docs/wp32-map.md §6.3): `for (const x of s.values())` walks a `Set` in
// insertion order, and an element added during the walk is visited.
export const main = (): i32 => {
  const s = new Set<number>();
  s.add(1).add(2).add(3);
  for (const x of s.values()) {
    if (x < 3) {
      s.add(x + 10);
    }
    console.log(`${x}`);
  }
  console.log(`size ${s.size}`);
  return 0;
};
