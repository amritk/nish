// WP27 S5: a freestanding wasm32 build has no operating system and no errno, so
// `cErrno` is refused there (`--profile wasi` links wasi-libc and keeps it).
import { cErrno } from "nish:unsafe";

export function lastErrno(): i32 {
  return cErrno();
}
