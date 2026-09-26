// WP32 S5 (docs/wp32-map.md §9.2): `nish/map` exports `reserve` and
// `getOrInsert` and nothing else, so importing any other name is refused.
import { peek } from "nish/map";

export const main = (): i32 => {
  const m = new Map<string, i32>();
  return peek(m, "a");
};
