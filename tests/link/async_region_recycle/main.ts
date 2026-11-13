// WP49 stage 6: a finished task's region stays on its node, emptied, for the
// node's next task, so a task that fits in what the region kept costs no
// malloc or free. `probe.c` drives the executor's C entry points: what the
// region keeps, what it gives back, and that the old handle goes stale
// (docs/security/async.md, ASYNC-20).
import { runProbe } from "./lib"

export const main = (): number => runProbe("async_region_recycle")
