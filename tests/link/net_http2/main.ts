// `nish/net/http2` in the default number mode: a connection driven by a
// scripted client with no socket — requests and streamed responses, flow
// control stalling and resuming, concurrent streams, PING, RST_STREAM and
// GOAWAY, extended CONNECT, and the arena held flat. The checks are in
// `checks.ts`, so that `tests/link/net_http2_f64` runs the same ones under
// `--number-mode f64`; the refusals are `tests/link/net_http2_errors`.
import { http2Checks } from "./checks";

export const main = (): i32 => http2Checks();
