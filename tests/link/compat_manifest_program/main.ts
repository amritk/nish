// WP28 C0: the root package's `nish.compat` puts the whole program in the
// compatibility dialect, so a bare `number` is the double in the root's module
// and in the dependency's, and a dependency that asks for the dialect too is
// under the root's ceiling.
import { half } from "pkg_loose";

const third = (n: number): number => n / 3;

export const main = (): i32 => {
  console.log(half(7));
  console.log(third(1) < 0.5);
  return 0;
};
