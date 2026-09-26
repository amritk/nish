// WP32 S5 (docs/wp32-map.md §9.2): the value of `getOrInsert` has the map's
// value type.
import { getOrInsert } from "nish/map";

export const main = (): i32 => {
  const m = new Map<string, i32>();
  getOrInsert(m, "a", "x");
  return 0;
};
