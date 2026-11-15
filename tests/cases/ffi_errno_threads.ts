// WP27 S5: the slot `cErrno()` reads is per thread under `--threads`. The
// driver (ffi_errno_threads.c) runs `stage` on two pthreads with different
// errno values, lets both finish before either reads, and each thread still
// reads its own. Parallel workers cannot call C (a foreign call is a shared
// write), so the threads are the driver's.
import { cErrno } from "nish:unsafe";

declare function set_errno_to(e: i32): i32;

export function stage(e: i32): i32 {
  return set_errno_to(e);
}

export function readErrno(): i32 {
  return cErrno();
}
