// WP32 (docs/wp32-map.md §6.2): `for...of` over a `Map` itself walks its
// `entries()`, `[key, value]` pairs that need destructuring, so it is refused
// with the rewrite that walks the keys or the values instead.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  let n: i32 = 0;
  for (const e of m) {
    n = n + 1;
  }
  return n;
};
