// The driver for `self/ice.ts` (docs/wp14-selfhost.md §7a), run by the WP14
// block of `tests/run.js`, which holds it to the report and the status below.
//
// A real internal compiler error cannot be provoked from a command line — the
// point of an invariant is that nothing reaches it — so what is pinned here is
// the report itself and the status behind it: the lines every
// `process.exit(internalError(...))` site in `self/` prints, and exit 70,
// which is the code `docs/wp12-release.md` gives internal errors and the one
// `NISH_SIMULATE_ICE` provokes in the compiler itself.
import { internalError } from "../../self/ice";

export function main(): number {
  process.exit(internalError("emitter: no callee recorded for `f`"));
}
