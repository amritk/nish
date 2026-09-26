// WP32 S5 (docs/wp32-map.md §9.1): not fused. A `get` of another map inside the
// value is a call between the probe and the write, and it is not the one read
// of the key the update pattern allows, so every call keeps its own probe.
const merge = (e: Map<string, number>, m: Map<string, number>, w: string): void => {
  e.set(w, (e.get(w) ?? 0) + (m.get(w) ?? 0));
};

export const main = (): i32 => {
  const e = new Map<string, number>();
  const m = new Map<string, number>();
  m.set("a", 10);
  merge(e, m, "a");
  merge(e, m, "a");
  merge(e, m, "b");
  console.log(`${e.get("a") ?? -1} ${e.get("b") ?? -1} ${e.size}`);
  return 0;
};
