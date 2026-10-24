// WP40: a dependency that reaches `process.spawn` the root package does not grant
// it is refused (NL2574), spanned in the dependency and naming the chain.
import { run } from "pkg_shell";

export const main = (): number => run("exit 3");
