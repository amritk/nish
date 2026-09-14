// WP18 G5 + WP21 §9c: an instantiated generic's *name* is program-wide exactly
// as a declared class's is (`tests/link/two_packages_struct`), and generics make
// it far easier to hit — two packages that each keep a private `Holder<T>` and
// each instantiate it at `i32` both produce `%struct.Holder$i32`.
//
// Left alone this is a miscompile rather than a link error, and one a reader
// would never suspect: `make()` hands this module a pkg_a `Holder<i32>` whose
// first field is `lead`, this module's own instantiation replaces the layout it
// was registered under, and `.value` then reads `lead`. Nothing about the two
// declarations is visible at the call.
//
// The declared half of the rule is caught before bodies are checked; this
// instantiation is asked for by a *body*, so it does not exist then. It is
// caught after `drainInstantiations`, where the set is final.
import { make } from "./node_modules/pkg_a/index";

class Holder<T> {
  value: T;

  constructor(v: T) {
    this.value = v;
  }
}

export const main = (): i32 => {
  const own = new Holder<i32>(7);
  return make().value + own.value;
};
