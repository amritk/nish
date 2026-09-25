// WP32: `??` does not mix with `||` without parentheses (TS5076).
export const main = (): i32 => {
  const m = new Map<string, i32>();
  const ok = m.get("a") ?? 1 || 2;
  return 0;
};
