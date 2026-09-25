// WP32: a `const` bound to `get` reads as `i32` only where a test narrowed it.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  const a = m.get("a");
  return a;
};
