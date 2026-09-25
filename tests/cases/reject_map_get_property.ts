// WP32: `get` is called, never read as a value.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  const f = m.get;
  return 0;
};
