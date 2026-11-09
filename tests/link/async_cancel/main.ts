// The executor's cancel paths leave nothing behind: a cancel with waits
// pending, a deadline that fires, a bounded wait that times out and a
// deadline `done` takes out each bring the live task and timer counts back to
// where they started (probe.c).
import { runProbe } from "./lib"

export const main = (): number => runProbe("async_cancel")
