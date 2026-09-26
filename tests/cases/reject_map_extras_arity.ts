// WP32 S5 (docs/wp32-map.md §9.2): `getOrInsert` takes the map, the key and the
// value to insert when the key is missing; there is no default.
import { getOrInsert } from "nish/map";

export const main = (): i32 => {
  const m = new Map<string, i32>();
  getOrInsert(m, "a");
  return 0;
};
