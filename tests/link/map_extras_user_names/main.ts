// WP32 S5 (docs/wp32-map.md §9.2): the native lowering belongs to the two
// functions of `nish/map`, found by module and not by name. A program's own
// `reserve`, and a `getOrInsert` imported from its own module `./map`, are
// ordinary functions: each call runs the body it names and prints its output.
import { getOrInsert } from "./map";

const reserve = (m: Map<string, i32>, n: i32): void => {
  console.log(`user reserve ${n}`);
};

export const main = (): i32 => {
  const m = new Map<string, i32>();
  reserve(m, 7);
  const got = getOrInsert(m, "a", 3);
  console.log(`got ${got} size ${m.size}`);
  return m.size;
};
