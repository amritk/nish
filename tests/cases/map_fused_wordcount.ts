// WP32 S5 (docs/wp32-map.md §9.1, pattern 1): word count. `counts.set(w,
// (counts.get(w) ?? 0) + 1)` asks about `w` twice, and is one probe: the
// `get` reads the probe the `set` makes first, the default runs only on its
// absent edge, and the write goes through the same answer — `setValueAt` of
// the entry found, or `insertAt` the empty bucket with the hash already
// computed. `tests/run.js` counts the one `probe` call in `count`.
const count = (counts: Map<string, number>, words: string[]): void => {
  for (const w of words) {
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
};

export const main = (): i32 => {
  const counts = new Map<string, number>();
  count(counts, ["the", "cat", "sat", "on", "the", "mat", "and", "the", "cat", "ran"]);
  for (const w of counts.keys()) {
    console.log(`${w} ${counts.get(w) ?? -1}`);
  }
  console.log(`${counts.size} words`);
  return 0;
};
