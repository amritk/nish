// WP32 S5 (docs/wp32-map.md §9.2): the first argument of `getOrInsert` is a
// `Map`. An array is not one, so the call is an argument-type error, as it is
// under `tsc`.
import { getOrInsert } from "nish/map";

export const main = (): i32 => {
  getOrInsert([1, 2], 0, 1);
  return 0;
};
