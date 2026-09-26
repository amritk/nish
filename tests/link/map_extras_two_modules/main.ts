// WP32 S5 (docs/wp32-map.md §9): a fused update and `nish/map`'s two calls in
// a program of two modules. Each module gets `internal` copies of the table's
// pieces its fused and lowered calls reach — `probe`, `valueAt`, `setValueAt`,
// `insertAt` and `reserveSlots` — and neither `std/collections.ts` nor
// `std/map.ts` writes a `.ll` of its own, so the directory holds `main.ll` and
// `words.ll` and nothing else.
import { getOrInsert } from "nish/map";
import { countInto } from "./words";

export const main = (): i32 => {
  const counts = new Map<string, i32>();
  countInto(counts, ["x", "y", "x", "x"]);
  const z = getOrInsert(counts, "z", 7);
  const x = getOrInsert(counts, "x", 7);
  console.log(`${counts.size} ${x} ${z}`);
  return counts.size;
};
