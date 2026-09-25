// WP32: `&&` on both sides of a `??` is one mix, reported once.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  const ok = true && m.has("a") ?? false && true;
  return 0;
};
