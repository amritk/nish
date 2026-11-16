// A transient failure of the io_uring probe or of a set's open is not latched
// (WP63 S2, NURING-20, NURING-22, NURING-26). tests/run.js's `net_ring`
// section runs this program under `ulimit -n 32`. Each step fills the
// descriptor table with poll loops, frees a few and makes a `NET_LISTEN_RING`
// listen, whose socket takes the first free descriptor:
// - With one left free, the probe's io_uring_setup answers -24. The listen
//   must succeed as a plain listener and netRingState() must stay 0.
// - With two left free, the probe passes on the second, which it closes
//   again, and the set's open runs short after its epoll takes it. The listen
//   must still succeed as a plain listener, and netRingState() must stay 0:
//   only an open set decides for rings.
// - With every descriptor free, a ring listen must open rings and
//   netRingState() must answer 1.
// - With rings open and one left free, a third ring listen, whose set's open
//   answers -24, must succeed as a plain listener and leave netRingState() 1.
// Exit 0 is a pass, 2 says the kernel refused rings, 1 is a failure, with its
// line.
import { NET_LISTEN_RING, netClose, netRingState, pollCreate, tcpListenFlags } from "nish:net"

/** Whether `state` is one of the answers that refuse io_uring for the process. */
const refused = (state: i32): boolean => state === -1 || state === -38 || state === -22 || state === -95

/**
 * Fills the descriptor table with poll loops, then closes `spare` of them.
 * @param fillers Where the loops' descriptors are kept.
 * @param spare How many descriptors to leave free.
 * @returns How many loops stay open, or -1 when the table did not fill with -24.
 */
const fill = (fillers: i32[], spare: i32): i32 => {
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
  if (last !== -24 || count < spare) {
    console.log(`filling the descriptor table ended at ${count} descriptors with ${last}, not -24`)
    return -1
  }
  let freed: i32 = 0
  while (freed < spare) {
    count -= 1
    netClose(fillers[count])
    freed += 1
  }
  return count
}

/**
 * Closes the first `count` loops `fill` opened.
 * @param fillers The loops' descriptors.
 * @param count How many are open.
 */
const drain = (fillers: i32[], count: i32): void => {
  let left: i32 = count
  while (left > 0) {
    left -= 1
    netClose(fillers[left])
  }
}

export const main = (): i32 => {
  const fillers: i32[] = new Array<i32>(64)
  let count: i32 = fill(fillers, 1)
  if (count < 0) {
    return 1
  }
  const first: i32 = tcpListenFlags("127.0.0.1", 0, 16, NET_LISTEN_RING)
  const during: i32 = netRingState()
  drain(fillers, count)
  if (refused(during)) {
    console.log(`rings refused: ${during}`)
    return 2
  }
  if (first < 0 || during !== 0) {
    console.log(`with no descriptor left the listen answered ${first} and netRingState() ${during}, not a listener and 0`)
    return 1
  }
  netClose(first)
  count = fill(fillers, 2)
  if (count < 0) {
    return 1
  }
  const short: i32 = tcpListenFlags("127.0.0.1", 0, 16, NET_LISTEN_RING)
  const shortState: i32 = netRingState()
  drain(fillers, count)
  if (refused(shortState)) {
    console.log(`rings refused: ${shortState}`)
    return 2
  }
  if (short < 0 || shortState !== 0) {
    console.log(`with the first set's open short the listen answered ${short} and netRingState() ${shortState}, not a listener and 0`)
    return 1
  }
  netClose(short)
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
  count = fill(fillers, 1)
  if (count < 0) {
    return 1
  }
  const third: i32 = tcpListenFlags("127.0.0.1", 0, 16, NET_LISTEN_RING)
  const later: i32 = netRingState()
  drain(fillers, count)
  if (third < 0 || later !== 1) {
    console.log(`with rings open and no descriptor left the listen answered ${third} and netRingState() ${later}, not a listener and 1`)
    return 1
  }
  netClose(third)
  netClose(second)
  console.log("transient: neither the probe's -24 nor the first set's was kept, the next listen opened rings, and a later set's -24 fell back to descriptors")
  return 0
}
