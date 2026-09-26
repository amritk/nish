// WP32 S5 (docs/wp32-map.md §9.2): `reserve` presizes a `Map`; a `Set` is not
// one, so nothing binds its type parameters.
import { reserve } from "nish/map";

export const main = (): i32 => {
  const s = new Set<string>();
  reserve(s, 10);
  return 0;
};
