// `nish/net/http-fields` in the default number mode: the field-name and value
// rules, the connection-specific fields, and the request, response and trailer
// shapes with every refusal. The checks are in `checks.ts`, so that
// `tests/link/net_http_fields_f64` runs the same ones under `--number-mode f64`.
import { fieldsChecks } from "./checks";

export const main = (): i32 => fieldsChecks();
