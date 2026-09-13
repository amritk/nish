// WP18 G5 + WP21 S1: an instantiated generic *class* carries its package's
// prefix on every method and constructor it produces, exactly as a generic
// function's `define` does (`tests/link/package_generic`).
//
// The trap is the same one and it is sprung one level deeper. An instantiated
// class's members are minted in `collectInstanceMembers`, which runs on either
// side of `Checker.qualifySymbols` — a signature annotation that names
// `Holder<i32>` is resolved before that walk, a `new Holder<i32>(v)` in a body
// long after — so the prefix has to be part of the symbol from the moment it is
// minted and `qualifySymbols` has to leave an instantiation alone. This program
// is what says both: the three `Holder<T>` templates give three `.get` symbols
// that differ only by prefix, and the whole-program fact table in
// `codegen/attributes.ts` is keyed by exactly that symbol.
//
// The three templates are instantiated at *different* type arguments on purpose
// — `i32` here, `i64` in pkg_a, `f64` in pkg_b — because the struct *name* is
// not package-scoped (docs/wp21-packages.md §9c) and three `%struct.Holder$i32`
// would be the clash `package_generic_class_clash` pins instead.
//
// The arithmetic tells the three apart: this `get` answers the field, pkg_a's
// doubles it and pkg_b's negates it, so 5 + 14 + (-3) is 16 and any pairing
// that reached the wrong instantiation gives a different exit code.
import { fromA } from "./node_modules/pkg_a/index";
import { fromB } from "./node_modules/pkg_b/index";

class Holder<T> {
  value: T;

  constructor(v: T) {
    this.value = v;
  }

  get(): T {
    return this.value;
  }
}

export const main = (): i32 => new Holder<i32>(5).get() + fromA() + fromB();
