// WP40: the same dependency, granted `process.spawn` by the root package, compiles.
import { run } from "pkg_shell";

export const main = (): number => run("exit 3");
