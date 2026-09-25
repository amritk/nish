// WP29: a private function and two arrows of this module, passed to templates
// `./lib` declares. The instantiations live in `lib.ll` and call back into
// this module, so `square` and the lifted arrows cannot be `internal`: they
// are `hidden` — in the final link, exported from nothing — and `lib.ll`
// declares them, attribute for attribute, the way this module declares an
// instantiation it calls.
import { mapInto, reduce } from "./lib";

const square = (x: f64): f64 => x * x;

export const main = (): i32 => {
  const src: f64[] = [1.0, 2.0, 3.0];
  const dst: f64[] = [0.0, 0.0, 0.0];
  mapInto(src, dst, square);
  const total = reduce(dst, (a, b) => a + b, 0.0);
  const product = reduce([1, 2, 3, 4], (a: i32, b: i32): i32 => a * b, 1);
  console.log(`${dst[2]} ${total} ${product}`);
  return 0;
};
