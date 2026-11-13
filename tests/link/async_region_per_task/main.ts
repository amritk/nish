// WP49 stage 5, debt (a): each spawned task owns a region, entered whenever
// the task runs, left when it suspends and emptied when it finishes, so what a
// task allocates is neither in `main`'s arena nor lost while another task
// runs. `probe.c` interleaves two tasks through the executor's C entry
// points, as the compiled driver does at each await; the program
// `tests/cases/async_sleep_spawn_string` pins the same from Nish.
import { runProbe } from "./lib"

export const main = (): number => runProbe("async_region_per_task")
