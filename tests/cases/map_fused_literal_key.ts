// WP32 S5 (docs/wp32-map.md §9.1): the key may be a literal, spelled the same
// in both calls. `totals.set("sum", (totals.get("sum") ?? 0) + x)` is one probe.
const add = (totals: Map<string, number>, x: number): void => {
  totals.set("sum", (totals.get("sum") ?? 0) + x);
};

export const main = (): i32 => {
  const totals = new Map<string, number>();
  add(totals, 2.5);
  add(totals, 4);
  add(totals, -1);
  console.log(`${totals.get("sum") ?? -1} ${totals.size}`);
  return 0;
};
