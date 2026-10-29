// `nish/net/url`'s URL parser and resolver under `--number-mode f64` (see
// `args`): every check in `tests/link/net_url_parse` again, unchanged, because
// a `std/` module has to mean the same thing in both modes
// (docs/wp26-stdlib.md §4).
import { urlParseChecks } from "../net_url_parse/checks";

export const main = (): i32 => urlParseChecks();
