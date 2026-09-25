// WP32: the default of `??` is `V`, so a second `get` there needs its own `??`.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  return m.get("a") ?? m.get("b") ?? 0;
};
