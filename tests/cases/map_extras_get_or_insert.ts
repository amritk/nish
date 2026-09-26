// WP32 S5 (docs/wp32-map.md §9.2): `getOrInsert(m, k, v)` from `nish/map`.
// Under Node its body runs, a `get` and a `set` when the key was missing.
// Natively the call is lowered in place to one probe of the key, then
// `valueAt` of the entry found or `insertAt` of `v` through the empty bucket
// the probe stopped at. `tests/run.js` counts the one `probe` in `firstSeen`.
import { getOrInsert } from "nish/map";

const firstSeen = (at: Map<string, number>, words: string[]): number => {
  let sum = 0;
  for (let i = 0; i < words.length; i++) {
    sum = sum + getOrInsert(at, words[i], i);
  }
  return sum;
};

export const main = (): i32 => {
  const at = new Map<string, number>();
  const sum = firstSeen(at, ["b", "a", "b", "c", "a", "b"]);
  for (const w of at.keys()) {
    console.log(`${w} ${at.get(w) ?? -1}`);
  }
  console.log(`${sum} ${at.size}`);
  return 0;
};
