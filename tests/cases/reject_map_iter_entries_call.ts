// WP32 (docs/wp32-map.md §6.2): there is no `entries()` to walk either.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  let n: i32 = 0;
  for (const e of m.entries()) {
    n = n + 1;
  }
  return n;
};
