// `pbkdf2HmacSha256` against RFC 7914 §11, in the default number mode. The
// checks are in `checks.ts`, so that `tests/link/std_pbkdf2_f64` runs the
// same ones under `--number-mode f64`.
import { pbkdf2Checks } from "./checks";

export const main = (): i32 => pbkdf2Checks();
