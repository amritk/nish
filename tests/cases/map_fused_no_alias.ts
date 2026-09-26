// WP32 S5 (docs/wp32-map.md §9.1): not fused. `n` and `m` are one table, but
// the rule compares the places the two calls name, not what they hold: `n` is
// a different local from `m`, so `n.set(k, (m.get(k) ?? 0) + 1)` stays a `get`
// on `m` and a `set` on `n`, one probe each.
const bump = (m: Map<string, number>, k: string): void => {
  const n = m;
  n.set(k, (m.get(k) ?? 0) + 1);
};

export const main = (): i32 => {
  const m = new Map<string, number>();
  bump(m, "a");
  bump(m, "a");
  bump(m, "b");
  console.log(`${m.get("a") ?? -1} ${m.get("b") ?? -1} ${m.size}`);
  return 0;
};
