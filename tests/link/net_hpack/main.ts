// `nish/net/hpack` against RFC 7541 in the default number mode: Appendix C,
// Appendix B, the table rules and every refusal. The checks are in
// `checks.ts`, so that `tests/link/net_hpack_f64` runs the same ones under
// `--number-mode f64`.
import { hpackChecks } from "./checks";

export const main = (): i32 => hpackChecks();
