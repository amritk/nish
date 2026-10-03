// `nish/crypto/sha1` under `--number-mode f64` (see `args`): every vector in
// `tests/link/crypto_sha1` again, unchanged, because a `std/` module has to
// compute the same thing in both modes (docs/wp26-stdlib.md §4).
import { sha1Checks } from "../crypto_sha1/checks";

export const main = (): i32 => sha1Checks();
