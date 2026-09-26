// WP32 S5 (docs/wp32-map.md §9.1): not fused. The two calls must spell the key
// the same way: `words[i]` and `w` hold the same string here, but an element
// is not a place the rule accepts, and `j` is a different local, so each call
// keeps its own probe.
const count = (m: Map<string, number>, words: string[]): void => {
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const j = w;
    m.set(w, (m.get(words[i]) ?? 0) + 1);
    m.set(j, (m.get(w) ?? 0) + 1);
  }
};

export const main = (): i32 => {
  const m = new Map<string, number>();
  count(m, ["p", "q", "p"]);
  console.log(`${m.get("p") ?? -1} ${m.get("q") ?? -1}`);
  return 0;
};
