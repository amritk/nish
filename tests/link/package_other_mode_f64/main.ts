// WP21 S3: the other half of `package_other_mode` — a package that offers Nish
// in i32 mode only, imported by a program compiled `--number-mode f64`
// (`docs/wp21-packages.md` §6). Both directions are pinned, because the
// message has to name whichever mode the package offers and whichever one this
// program is compiled in.
import { mask } from "pkg_i32";

export const main = (): i32 => toI32(mask(15));
