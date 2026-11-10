// WP49 stage 6: a descriptor stays registered with the executor, so a
// program that closes it and reuses its number while a task waits has the
// next wait on the number fail the old wait, never answer it for the new file.
// `probe.c` drives the executor's C entry points the way the compiled driver
// does; this program builds it against the runtime and runs it.
// docs/security/async.md, ASYNC-4.
import { runProbe } from "./lib"

export const main = (): number => runProbe("async_fd_reuse")
