// WP32 S5 (docs/wp32-map.md §9.1): a guard fuses only the write that starts its
// then-branch. Here that `set` is `setValueAt` through the `has`'s probe, and
// the `set` in the `else` branch is an ordinary call with a probe of its own.
const put = (g: Map<string, number>, w: string): void => {
  if (g.has(w)) {
    g.set(w, 100);
    console.log(`again ${w}`);
  } else {
    g.set(w, 5);
  }
};

export const main = (): i32 => {
  const g = new Map<string, number>();
  put(g, "a");
  put(g, "b");
  put(g, "a");
  console.log(`${g.get("a") ?? -1} ${g.get("b") ?? -1} ${g.size}`);
  return 0;
};
