// WP49 stage 6: a wait on an epoll descriptor keeps its registered duplicate
// between waits and re-arms it, so a served program's poller is not re-added
// to the executor's epoll set (a walk of every connection) on every wait.
// `probe.c` drives the executor's C entry points the way the compiled driver
// does; this program builds it against the runtime and runs it.
// docs/security/async.md, ASYNC-4.
import { runProbe } from "./lib"

export const main = (): number => runProbe("async_epoll_kept")
