// WP18 G7 + WP21 S1: the trap §16 marks, closed.
//
// An instantiation's symbol used to be minted from the *instantiating*
// module's package prefix, which was correct only while importing a template
// was refused — the module that instantiated was always the module that
// declared, so the two prefixes were the same one. They are not here: the root
// package and `pkg_a` both instantiate `pkg_lib`'s `pick<T>` and `Holder<T>` at
// `i32`, and the symbol has to be the *template's* — `@pkg_lib.pick$i32`, one
// definition, declared by both askers.
//
// Getting it wrong is a miscompile rather than a link error, which is why this
// program is here rather than a comment. Two packages that each minted
// `@pick$i32` would collide in `codegen/attributes.ts`, whose whole-program
// fact table is keyed by symbol, and one instantiation would be emitted with
// the other's purity and escape facts. `tests/link/package_generic` is the
// other half of the pair: three packages each declaring a private `pick<T>`,
// which must stay three symbols.
import { fromA } from "./node_modules/pkg_a/index";
import { Holder, pick } from "./node_modules/pkg_lib/index";

export const main = (): i32 => pick(1, 9) + new Holder<i32>(4).get() + fromA();
