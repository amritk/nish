// WP18 G5: an instantiated generic's name is program-wide, and packages make no
// difference to that. `tests/link/package_generic_class_clash` is the same
// mistake made across two packages; this is the one anybody can make inside one,
// with two modules of the same program each keeping a private `Holder<T>`.
//
// Left alone it is a miscompile a reader would never suspect. `make()` hands
// this module a `Holder<i32>` whose first field is `lead`, this module's own
// instantiation registers a one-field `%struct.Holder$i32` under the same name,
// and `.value` then reads `lead` — 118 instead of 229. The two modules also
// both emit `@Holder$i32.constructor`, so `llvm-as` refuses the entry module
// with `invalid redefinition of function`. Neither is reported by the declared
// half of the rule: `rejectSymbolClashes` runs before bodies are checked, and a
// generic class has no symbol at all until an instantiation exists.
import { make } from "./helper";

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
