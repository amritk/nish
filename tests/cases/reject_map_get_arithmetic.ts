// WP32 (§3.1 E): TS2532 under `tsc`; `??` gives the default first.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  m.set("a", m.get("a") + 1);
  return 0;
};
