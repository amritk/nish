// `nish/net/http2`'s refusals in the default number mode: every connection
// error with the GOAWAY it sends, and every stream error with the RST_STREAM
// it sends and the connection still answering after it. The checks are in
// `checks.ts`, so that `tests/link/net_http2_errors_f64` runs the same ones
// under `--number-mode f64`.
import { errorChecks } from "./checks";

export const main = (): i32 => errorChecks();
