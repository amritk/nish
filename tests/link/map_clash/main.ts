// WP32 (docs/wp32-map.md §4.2): `shapes.ts` declares a class `Map` of its own,
// which would be legal on its own, while this module names the global `Map`. A
// class name is program-wide, so the program is refused at the declaration,
// naming the module that uses the global (NL3030).
import { area } from "./shapes";

export const main = (): i32 => {
  const m = new Map<string, i32>();
  m.set("square", area());
  return m.size;
};
