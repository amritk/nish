// WP32 (docs/wp32-map.md §4.2): a module that declares its own `Map` keeps it,
// as it would under `tsc`, and gets no implicit import; a module that names the
// global `Set` in the same program still gets the global one, because the two
// names are loaded one at a time.
import { distinct } from "./unique";

class Map {
  size: i32 = 40;
}

export const main = (): i32 => {
  const own = new Map();
  const n = distinct();
  console.log(`${own.size} ${n}`);
  return own.size + n;
};
