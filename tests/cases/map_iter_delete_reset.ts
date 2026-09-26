// WP32 (docs/wp32-map.md §6.2, fourth row): a key deleted and set again during
// a walk becomes a new entry at the end, so the walk visits it a second time.
export const main = (): i32 => {
  const m = new Map<string, number>();
  m.set("x", 1).set("y", 2).set("z", 3);
  let visits = 0;
  for (const k of m.keys()) {
    visits++;
    console.log(`${k} ${m.get(k) ?? 0}`);
    if (k === "x" && visits === 1) {
      m.delete("x");
      m.set("x", 100);
    }
  }
  console.log(`visits ${visits}`);
  return 0;
};
