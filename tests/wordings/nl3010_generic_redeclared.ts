// NL3010: two modules declaring one generic name. An instantiation is named
// after its template, so both would emit `@identity$i32` — the same collision
// the plain-function rule refuses, one namespace up. Within one package: two
// *packages* may each keep a private `identity<T>`, because an instantiation
// carries its package's prefix (`tests/link/package_generic`).
//
// `anchor` is imported only to load the other module; the clash is between the
// two `identity` templates and not between anything this file names.
import { anchor } from "./wordings_generic";

const identity = <T>(x: T): T => x;

export const main = (): i32 => identity(1) + anchor();
