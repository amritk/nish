// WP32: nor in an array literal.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  const a: i32[] = [m.get("a")];
  return a[0];
};
