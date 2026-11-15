// WP49 stage 6: a finished task's region is recycled for the next task on its
// node, not freed (docs/security/async.md, ASYNC-20). `probe.c` drives the
// executor's C entry points: a later task is entered with the chunk the last
// one left, empty; 100000 tasks move the peak resident size by nothing; a
// region that grew through several chunks keeps one of them; a chunk past
// 64 KiB is freed; and 600 tasks at once keep 16 MiB between them, not all
// they held. `tests/link/async_recycle_fresh` pins from Nish that what the
// language promises zeroed still is.
import { runProbe } from "./lib"

export const main = (): number => runProbe("async_region_recycle")
