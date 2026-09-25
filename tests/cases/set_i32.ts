// WP32 (docs/wp32-map.md §6.3): a `Set<i32>` counts distinct values with one
// probe per `add`; 1000 values with 97 distinct ones leave 97.
export const main = (): i32 => {
  const s = new Set<i32>();
  for (let i: i32 = 0; i < 1000; i++) {
    s.add((i * 31) % 97);
  }
  console.log(`${s.size} ${s.has(0)} ${s.has(96)} ${s.has(97)}`);
  return 0;
};
