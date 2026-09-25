// WP32: `i32 | undefined` is spelled only on a `const` initialised from `get`.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  let g: i32 | undefined = m.get("a");
  return 0;
};
