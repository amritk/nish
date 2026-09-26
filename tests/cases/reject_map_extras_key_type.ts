// WP32 S5 (docs/wp32-map.md §9.2): the key of `getOrInsert` has the map's key
// type.
import { getOrInsert } from "nish/map";

export const main = (): i32 => {
  const m = new Map<string, i32>();
  getOrInsert(m, 1, 2);
  return 0;
};
