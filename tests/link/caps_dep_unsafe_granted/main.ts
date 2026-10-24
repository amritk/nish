// WP40: the same dependency, granted `unsafe` by the root package, compiles.
import { mix } from "pkg_fast";

export const main = (): i32 => mix(7) + 4;
