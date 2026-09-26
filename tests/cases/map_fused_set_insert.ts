// WP32 S5 (docs/wp32-map.md §9.1, pattern 3): `if (!s.has(x)) { s.add(x);
// ... }` is one probe and an `insertAt` through it, and the rest of the branch
// runs only where the element was inserted, as it did before.
const distinct = (s: Set<i32>, xs: i32[]): i32 => {
  let fresh: i32 = 0;
  for (const x of xs) {
    if (!s.has(x)) {
      s.add(x);
      fresh = fresh + 1;
    }
  }
  return fresh;
};

export const main = (): i32 => {
  const s = new Set<i32>();
  const fresh = distinct(s, [4, 1, 4, 9, 1, 1, 7]);
  let listed = "";
  for (const x of s) {
    listed = `${listed} ${x}`;
  }
  console.log(`${fresh} fresh:${listed}`);
  return 0;
};
