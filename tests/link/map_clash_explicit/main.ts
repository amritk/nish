// WP32 (docs/wp32-map.md §4.2): importing the global `Map` by name from
// `nish/collections` uses it as much as naming it does, so `shapes.ts`'s own
// `Map` is refused here as it is in `map_clash` (NL3030).
import { Map } from "nish/collections";
import { area } from "./shapes";

export const main = (): i32 => {
  const m = new Map<string, i32>();
  m.set("square", area());
  return m.size;
};
