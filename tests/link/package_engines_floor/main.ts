// WP21 S3: a package whose `engines.nish` floor is above the running compiler
// (`docs/wp21-packages.md` §5c, §6).
//
// The entry point resolves and would compile. The package has still said that
// this compiler is too old for its source, so the program is refused at the
// boundary, naming the package, the floor and this compiler's version. The
// floor is far enough ahead that no release will reach it.
import { seed } from "pkg_future";

export const main = (): i32 => seed();
