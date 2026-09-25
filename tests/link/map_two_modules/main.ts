// WP32 (docs/wp32-map.md §4.1): two modules pass one `Map<string, i32>` between
// them. Each module gets `internal` copies of the members it calls, and neither
// declares the other's: the struct is laid out by name, program-wide, so the
// copies agree on it. `std/collections.ts` writes no `.ll` of its own.
import { record } from "./tally";

export const main = (): i32 => {
  const m = new Map<string, i32>();
  record(m, "a");
  record(m, "b");
  record(m, "a");
  m.set("c", 3);
  console.log(`${m.size} ${m.has("a")} ${m.has("z")}`);
  return m.size;
};
