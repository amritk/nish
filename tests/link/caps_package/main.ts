// WP35: a capability reached only through a package. `pkg_caps` reads its
// configuration file through a helper private to the package, so the report
// gives `fs.read` to the package and to its module, and `main`'s witness
// crosses the package boundary into a function no importer can name. The
// module's path is relative to this directory, so the report reads the same
// from any checkout. The exit code is the file's length: 10.
import { configSize } from "pkg_caps";

export const main = (): i32 => configSize("tests/link/caps_package/config.txt");
