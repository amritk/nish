// WP49 stage 5: a spawned task's node comes from its kind's slab, which grows
// to the most tasks of the kind ever in flight and is then reused, so a
// server that spawns a task per connection allocates nothing per connection
// once it has seen its peak. `probe.c` spawns through the executor's C entry
// points and reads the nodes allocated (`nish_async_stat(0)`).
import { runProbe } from "./lib"

export const main = (): number => runProbe("async_slab_flat")
