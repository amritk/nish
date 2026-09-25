// WP32 (docs/wp32-map.md §4.1): under `-g` each copy of a library function the
// module uses carries a `DISubprogram` in a `DIFile` of its own,
// `std/collections.ts`, the file its lines are in, while the program's own
// functions keep theirs.
export const main = (): i32 => {
  const s = new Set<i32>();
  s.add(3).add(4);
  console.log(`${s.size} ${s.has(3)}`);
  return 0;
};
