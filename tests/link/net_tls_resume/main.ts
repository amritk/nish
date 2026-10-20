// The TLS 1.3 resumption table run through a `TlsRecordServer` in the default
// number mode. The checks are in `checks.ts`, so that
// `tests/link/net_tls_resume_f64` runs the same ones under `--number-mode f64`.
import { resumeChecks } from "./checks";

export const main = (): i32 => resumeChecks();
