// WP49 stage 5: a completion that arrives after its task finished is dropped,
// not delivered to whatever task holds the node by then. The language has no
// way yet to leave a wait behind (cancellation is a later stage), so
// `probe.c` drives the executor's C entry points the way the compiled driver
// does; this program builds it against the runtime and runs it.
// docs/security/async.md, ASYNC-1.
import { runProbe } from "./lib"

export const main = (): number => runProbe("async_late_completion")
