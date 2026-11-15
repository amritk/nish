// WP40 §2a and §6: the lockfile records `pkg_shell` granted
// `process.spawn=sh`; the root package now grants it `exec:sh`, which lets
// sh's subtree start other programs under `--sandbox`. The prefix is part of
// the recorded text, so the build refuses the widening (NL2593) until the
// lock is rewritten.
import { run } from "pkg_shell";

export const main = (): number => run("exit 3");
