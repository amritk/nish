// WP34 N5: the readiness loop in `nish:net`. `pollCreate`, `pollAdd` and the
// rest that change what a loop watches never wait, so they keep `willreturn`;
// `pollWait` can wait forever and is `nounwind` alone. Its `ready` is an
// `i32[]` it fills, so it travels as its header, `nocapture` but not
// `readonly`.
import { pollAdd, pollCreate, pollWait } from "nish:net"

export const watch = (fd: i32, token: i32): i32 => {
  const loop = pollCreate()
  if (loop < 0) {
    return loop
  }
  return pollAdd(loop, fd, 1, token) === 0 ? loop : -1
}

export const firstReady = (loop: i32, ready: i32[]): i32 => (pollWait(loop, ready, 100) > 0 ? ready[0] : -1)
