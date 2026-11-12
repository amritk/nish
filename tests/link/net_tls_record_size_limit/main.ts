// The record_size_limit extension (RFC 8449) on the TLS server: the limit a
// client sets caps every protected record the server writes, a limit below
// 64 or a malformed extension is refused, and the server answers with its
// own. The checks are in `checks.ts`.
import { recordSizeLimitChecks } from "./checks";

export const main = (): i32 => recordSizeLimitChecks();
