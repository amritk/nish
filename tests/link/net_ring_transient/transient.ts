// A transient failure of the io_uring probe is not latched (WP63 S2,
// NURING-20). tests/run.js's `net_ring` section runs this program under
// `ulimit -n 32`. It fills the descriptor table with poll loops, frees one,
// and makes a `NET_LISTEN_RING` listen, whose socket takes that last
// descriptor, so the probe's io_uring_setup answers -24. The listen must still
// succeed, as a plain listener, and netRingState() must stay 0. Once the
// descriptors are free again, a second ring listen must open rings and
// netRingState() must answer 1. Exit 0 is a pass, 2 says the kernel refused
// rings, 1 is a failure, with its line.
import { NET_LISTEN_RING, netClose, netRingState, pollCreate, tcpListenFlags } from "nish:net"

/** Whether `state` is one of the answers that refuse io_uring for the process. */
const refused = (state: i32): boolean => state === -1 || state === -38 || state === -22 || state === -95

export const main = (): i32 => {
  const fillers: i32[] = new Array<i32>(64)
  let count: i32 = 0
  let last: i32 = 0
  while (count < 64) {
    last = pollCreate()
    if (last < 0) {
      break
    }
    fillers[count] = last
    count += 1
  }
  if (last !== -24 || count === 0) {
    console.log(`filling the descriptor table ended at ${count} descriptors with ${last}, not -24`)
    return 1
  }
  count -= 1
  netClose(fillers[count])
  const first: i32 = tcpListenFlags("127.0.0.1", 0, 16, NET_LISTEN_RING)
  const during: i32 = netRingState()
  while (count > 0) {
    count -= 1
    netClose(fillers[count])
  }
  if (refused(during)) {
    console.log(`rings refused: ${during}`)
    return 2
  }
  if (first < 0 || during !== 0) {
    console.log(`with no descriptor left the listen answered ${first} and netRingState() ${during}, not a listener and 0`)
    return 1
  }
  netClose(first)
  const second: i32 = tcpListenFlags("127.0.0.1", 0, 16, NET_LISTEN_RING)
  const after: i32 = netRingState()
  if (refused(after)) {
    console.log(`rings refused: ${after}`)
    return 2
  }
  if (second < 0 || after !== 1) {
    console.log(`with descriptors free again the listen answered ${second} and netRingState() ${after}, not a listener and 1`)
    return 1
  }
  netClose(second)
  console.log("transient: the probe's -24 was not kept, and the next listen opened rings")
  return 0
}
