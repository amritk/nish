// WP32: only a `get` result is compared with `undefined`; `undefined` stays refused elsewhere.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  const x: i32 = 1;
  return x === undefined ? 1 : 0;
};
