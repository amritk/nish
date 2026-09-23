// WP21 S3: what is left of the one S2 message once the specific causes are
// split out (`docs/wp21-packages.md` §10d). `pkg_one` is a Nish package and
// exports `.`; it does not export `./extra`, so this compiler has no file to
// compile for that subpath and says so in S2's words.
import { seed } from "pkg_one/extra";

export const main = (): i32 => seed();
