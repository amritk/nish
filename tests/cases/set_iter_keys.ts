// WP32 (docs/wp32-map.md §6.3): a `Set`'s `keys()` is its `values()` in
// JavaScript, so `for (const x of s.keys())` is the same insertion-order walk.
export const main = (): i32 => {
  const s = new Set<number>();
  for (let i = 5; i > 0; i--) {
    s.add(i * 3);
  }
  s.delete(9);
  s.add(9);
  for (const x of s.keys()) {
    console.log(`${x}`);
  }
  return 0;
};
