// WP21 S3: a package that offers Nish in f64 mode only, imported by a program
// compiled in i32 (`docs/wp21-packages.md` §5c, §6).
//
// `pkg_f64` declares `nish-f64` and neither `nish` nor `nish-i32`. The file is
// there and would compile, so the failure is not a missing module: it is a
// mode mismatch at the package boundary, named with both modes, before a byte
// of the dependency is checked.
import { half } from "pkg_f64";

export const main = (): i32 => half(14);
