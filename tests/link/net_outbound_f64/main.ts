// `nish/net/outbound` under `--number-mode f64` (see `args`): every check
// in `tests/link/net_outbound` again, unchanged, because a `std/` module
// has to mean the same thing in both modes (docs/wp26-stdlib.md §4).
import { outboundChecks } from "../net_outbound/checks";

export const main = (): i32 => outboundChecks();
