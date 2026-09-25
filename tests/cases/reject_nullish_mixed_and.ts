// WP32: nor with `&&`, on either side.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  const ok = true && m.has("a") ?? false;
  return 0;
};
