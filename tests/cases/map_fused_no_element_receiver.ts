// WP32 S5 (docs/wp32-map.md §9.1): not fused. The receiver may not be an
// element access: `tables[t]` is evaluated anew by each call, so the rule does
// not take the two for one table. The `get` and the `set` stay separate.
const bump = (tables: Map<string, number>[], t: number, k: string): void => {
  tables[t].set(k, (tables[t].get(k) ?? 0) + 1);
};

export const main = (): i32 => {
  const tables = [new Map<string, number>(), new Map<string, number>()];
  bump(tables, 1, "x");
  bump(tables, 1, "x");
  bump(tables, 0, "x");
  console.log(`${tables[0].get("x") ?? -1} ${tables[1].get("x") ?? -1}`);
  return 0;
};
