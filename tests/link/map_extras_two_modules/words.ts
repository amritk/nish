// The other module: it presizes the map its caller made and counts into it
// with one probe per word.
import { reserve } from "nish/map";

export const countInto = (counts: Map<string, i32>, words: string[]): void => {
  reserve(counts, words.length);
  for (const w of words) {
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
};
