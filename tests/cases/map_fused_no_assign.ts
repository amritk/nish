// WP32 S5 (docs/wp32-map.md §9.1): not fused. An assignment inside the value,
// `++` here, is a write between the probe and the write through it, so the
// `get` and the `set` stay separate. Evaluation order is JavaScript's either
// way: the `get`, then `i++`, then the `set`.
const step = (m: Map<string, number>, k: string, i: number): number => {
  let at = i;
  m.set(k, (m.get(k) ?? 0) + at++);
  return at;
};

export const main = (): i32 => {
  const m = new Map<string, number>();
  const a = step(m, "a", 5);
  const b = step(m, "a", a);
  console.log(`${m.get("a") ?? -1} ${a} ${b}`);
  return 0;
};
