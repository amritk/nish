// NL3010: two modules exporting one generic name. An instantiation is named
// after its template, so both would emit `@identity$i32` — the same collision
// the exported-function rule refuses, one namespace up. Two *packages* may
// each keep a private `identity<T>`, because an instantiation carries its
// package's prefix (`tests/link/package_generic`), and since WP57 S1 two
// modules may too, because a private template that clashes is qualified by
// its module's path (`tests/link/module_private_generic`). Both of these are
// exported, so neither is qualified and they clash.
//
// `anchor` is imported only to load the other module; the clash is between the
// two `identity` templates and not between anything this file names.
import { anchor } from "./wordings_generic";

export const identity = <T>(x: T): T => x;

export const main = (): i32 => identity(1) + anchor();
