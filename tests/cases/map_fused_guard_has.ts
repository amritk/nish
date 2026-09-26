// WP32 S5 (docs/wp32-map.md §9.1, pattern 2): `if (m.has(k)) { m.set(k, E);
// ... }`, the `set` first in the branch. The condition is the probe, and the
// branch runs only where it found the key, so the `set` is `setValueAt` of the
// entry found, with no probe and no branch of its own.
const raise = (m: Map<string, number>, k: string, by: number): boolean => {
  if (m.has(k)) {
    m.set(k, by * 10);
    return true;
  }
  return false;
};

export const main = (): i32 => {
  const m = new Map<string, number>();
  m.set("a", 1);
  m.set("b", 2);
  console.log(`${raise(m, "a", 4)} ${raise(m, "c", 5)} ${m.get("a") ?? -1} ${m.has("c")} ${m.size}`);
  return 0;
};
