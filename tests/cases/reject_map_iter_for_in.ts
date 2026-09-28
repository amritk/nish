// WP32 (docs/wp32-map.md §6.2): `for...in` enumerates property names, which a
// `Map` has none of worth walking; Phase 0 refuses it (NL1056).
export const main = (): i32 => {
  const m = new Map<string, i32>();
  let n: i32 = 0;
  for (const k in m) {
    n = n + 1;
  }
  return n;
};
