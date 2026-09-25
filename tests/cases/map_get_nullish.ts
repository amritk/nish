// WP32 (docs/wp32-map.md §3.2): word count, `m.set(w, (m.get(w) ?? 0) + 1)`.
// `get` is one probe, and its value is read only on the found edge; the
// default runs only where the word is missing. The counts print in insertion
// order, which is Node's order for the same program.
export const main = (): i32 => {
  const words = ["the", "cat", "sat", "on", "the", "mat", "and", "the", "cat", "ran"];
  const counts = new Map<string, number>();
  const order: string[] = [];
  for (const w of words) {
    if (!counts.has(w)) {
      order.push(w);
    }
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  for (const w of order) {
    console.log(`${w} ${counts.get(w) ?? -1}`);
  }
  console.log(`dog ${counts.get("dog") ?? -1}`);
  return 0;
};
