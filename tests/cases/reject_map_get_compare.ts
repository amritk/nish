// WP32: `V | undefined` is compared only with `undefined`.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  return m.get("a") === 1 ? 1 : 0;
};
