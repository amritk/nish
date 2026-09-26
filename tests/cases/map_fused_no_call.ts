// WP32 S5 (docs/wp32-map.md §9.1): not fused. A call inside the value could
// grow the table, delete from it or clear it, which would move the bucket the
// probe found, so `m.set(k, bump(m.get(k) ?? 0))` stays a `get` and a `set`,
// one probe each, and answers what they answer.
const bump = (n: number): number => n + 1;

const touch = (m: Map<string, number>, k: string): void => {
  m.set(k, bump(m.get(k) ?? 0));
};

export const main = (): i32 => {
  const m = new Map<string, number>();
  touch(m, "a");
  touch(m, "a");
  touch(m, "b");
  console.log(`${m.get("a") ?? -1} ${m.get("b") ?? -1}`);
  return 0;
};
