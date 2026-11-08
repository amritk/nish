// WP49 stage 5: a descriptor wait registers a duplicate, so a program that
// closes the descriptor and reuses its number while a task waits cannot have
// the wait answer for the new file. `probe.c` drives the executor's C entry
// points the way the compiled driver does; this program builds it against the
// runtime and runs it. docs/security/async.md, ASYNC-4.
import { runProbe } from "./lib"

export const main = (): number => runProbe("async_fd_reuse")
