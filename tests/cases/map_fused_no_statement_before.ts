// WP32 S5 (docs/wp32-map.md §9.1): not fused. The write of a guard must be the
// branch's first statement; here a statement comes before it, so the `has` and
// the `add` stay separate calls, one probe each.
const record = (s: Set<string>, order: string[], x: string): void => {
  if (!s.has(x)) {
    order.push(x);
    s.add(x);
  }
};

export const main = (): i32 => {
  const s = new Set<string>();
  const order: string[] = [];
  record(s, order, "b");
  record(s, order, "a");
  record(s, order, "b");
  console.log(`${order.length} ${order[0]}${order[1]} ${s.size}`);
  return 0;
};
