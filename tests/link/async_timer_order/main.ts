// WP49 stage 5: the resume order of a real wait. One kernel wait reports the
// ready descriptors first, in the kernel's order, then the timers that are
// due, earliest deadline first and, between equal deadlines, in the order they
// were made. `zero` sleeps 0 ms before `reader` waits on a socket that already
// holds a byte, yet the reader resumes first; the sleepers then wake by
// deadline, not by the order they were spawned in.
import { spawn } from "nish:async"
import { NET_UNIX_STREAM, netClose, netWrite, unixSocketPair } from "nish:net"
import { nap, reader } from "./lib"

export async function main(): Promise<i32> {
  const fds: i32[] = [0, 0]
  if (unixSocketPair(NET_UNIX_STREAM, fds) < 0) {
    return 1
  }
  const one: u8[] = [1]
  netWrite(fds[1], one, 0, 1)
  spawn(nap("zero", 0))
  spawn(reader(fds[0]))
  spawn(nap("late", 40))
  spawn(nap("soon", 10))
  spawn(nap("middle", 25))
  spawn(nap("soon again", 10))
  netClose(fds[1])
  return 0
}
