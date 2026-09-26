// WP32 (docs/wp32-map.md §6.2, first row): a key set for the first time during
// a walk is appended past the cursor, so the same walk visits it.
export const main = (): i32 => {
  const m = new Map<string, number>();
  m.set("a", 1).set("b", 2);
  for (const k of m.keys()) {
    console.log(k);
    if (k === "a") {
      m.set("c", 3);
    }
    if (k === "c") {
      m.set("d", 4);
    }
  }
  console.log(`size ${m.size}`);
  return 0;
};
