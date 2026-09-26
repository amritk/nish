// WP32 S5 (docs/wp32-map.md §9.1, pattern 2): `if (!m.has(k)) { m.set(k, E);
// ... }`. The condition is the probe, and the branch runs only where the key
// is missing, so the `set` is `insertAt` the empty bucket the probe stopped
// at, reusing its hash. What follows it in the branch runs as before.
const firstIndex = (m: Map<string, number>, words: string[]): void => {
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (!m.has(w)) {
      m.set(w, i);
      console.log(`new ${w}`);
    }
  }
};

export const main = (): i32 => {
  const m = new Map<string, number>();
  firstIndex(m, ["x", "y", "x", "z", "y"]);
  for (const w of m.keys()) {
    console.log(`${w} ${m.get(w) ?? -1}`);
  }
  return 0;
};
