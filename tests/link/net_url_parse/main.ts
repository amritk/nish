// `nish/net/url`'s URL parser and resolver in the default number mode. The
// checks are in `checks.ts`, so that `tests/link/net_url_parse_f64` runs the
// same ones under `--number-mode f64`.
import { urlParseChecks } from "./checks";

export const main = (): i32 => urlParseChecks();
