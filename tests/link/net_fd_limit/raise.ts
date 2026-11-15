// The first `nish:net` call that makes a descriptor raises the soft
// RLIMIT_NOFILE to the hard limit. tests/run.js's `net_fd_limit` section
// starts this program under a soft limit of 64 with the hard limit left
// higher: past the listener it holds 200 more descriptors, where a program
// held to the 64 it was started with fails with -24 (EMFILE) near 61.
import { netClose, pollCreate, tcpListen } from "nish:net"

/** How many loop descriptors the program holds at once. */
const HELD: i32 = 200

export const main = (): i32 => {
  const listener: i32 = tcpListen("127.0.0.1", 0, 8)
  if (listener < 0) {
    console.log(`tcpListen failed with ${listener}`)
    return 1
  }
  const held: i32[] = []
  while (toI32(held.length) < HELD) {
    const fd: i32 = pollCreate()
    if (fd < 0) {
      console.log(`pollCreate failed with ${fd} after ${held.length} descriptors`)
      return 1
    }
    held.push(fd)
  }
  for (const fd of held) {
    netClose(fd)
  }
  netClose(listener)
  console.log(`held ${HELD} descriptors past a soft limit of 64`)
  return 0
}
