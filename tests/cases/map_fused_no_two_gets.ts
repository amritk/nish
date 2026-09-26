// WP32 S5 (docs/wp32-map.md §9.1): not fused. The update pattern asks about the
// key exactly once inside the value; here it asks twice, so the two `get`s and
// the `set` are three calls, one probe each.
const twice = (d: Map<string, number>, w: string): void => {
  d.set(w, (d.get(w) ?? 0) + (d.get(w) ?? 0) + 1);
};

export const main = (): i32 => {
  const d = new Map<string, number>();
  twice(d, "x");
  twice(d, "x");
  twice(d, "x");
  console.log(`${d.get("x") ?? -1}`);
  return 0;
};
