// WP49 stage 6: a waited descriptor stays registered with the executor, so a
// task that waits on one descriptor turn after turn pays one kernel call per
// wait, opens no descriptor, and shares the registration with every other
// task waiting on it. `probe.c` drives the executor's C entry points the way
// the compiled driver does; this program builds it against the runtime and
// runs it. docs/security/async.md, ASYNC-4 and ASYNC-9.
import { runProbe } from "./lib"

export const main = (): number => runProbe("async_fd_steady")
