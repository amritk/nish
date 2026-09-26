// NL2375: `for...of` over the global `Map` itself, which would need `entries()`.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  for (const e of m) {
  }
  return 0;
};
