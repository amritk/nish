// WP21 S3: an `engines.nish` floor this compiler meets, in the two-number
// spelling with a blank after the operator (`docs/wp21-packages.md` §6). The
// program compiles and the exit code is the package's answer; a floor read
// wrongly would refuse it.
import { seed } from "pkg_floor";

export const main = (): i32 => seed();
