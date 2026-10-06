// `nish/net/qpack` against RFC 9204 in the default number mode: Appendix B.1,
// every entry of Appendix A, round trips with and without Huffman, and every
// instruction a dynamic table of capacity 0 refuses. The checks are in
// `checks.ts`, so that `tests/link/net_qpack_f64` runs the same ones under
// `--number-mode f64`.
import { qpackChecks } from "./checks";

export const main = (): i32 => qpackChecks();
