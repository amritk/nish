// #347: a value read out of a `Map` of typed arrays is the typed array to
// TypeScript: `m.get(k)` once narrowed, `m.get(k) ?? d`, a `values()` walk,
// whether the `Map` is made with `new Map<K, V>()`, annotated, or a field.
// A `Map` of `f64[]` and its keys carry nothing, and neither does the `Map`.
class Cache {
  rows: Map<string, Int32Array>;
  constructor() {
    this.rows = new Map<string, Int32Array>();
  }
}

export const test = (): number => {
  const m = new Map<string, Float64Array>();
  m.set("a", new Float64Array(2));
  const v = m.get("a");
  if (v !== undefined) {
    v.pop();
  }
  (m.get("b") ?? new Float64Array(1)).pop();
  for (const w of m.values()) {
    w.push(1.0);
  }
  const c = new Cache();
  const r = c.rows.get("a");
  if (r !== undefined) {
    r.push(1);
  }
  const grows: Map<string, f64[]> = new Map();
  const g = grows.get("a");
  if (g !== undefined) {
    g.push(1.0);
  }
  let n = 0;
  for (const k of m.keys()) {
    n = n + k.length;
  }
  return n + m.size;
};
