// WP32: nor an argument of a builtin.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  console.log(m.get("a"));
  return 0;
};
