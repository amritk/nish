// A full ring set (WP63 S2, NURING-6). tests/run.js's `net_ring` section
// starts this program under a descriptor limit of 32, which bounds both the
// slots in a ring and the rings the process can make, and `client.mjs` holds
// 800 connections open to the port it prints, more than the set can take.
// The program accepts until tcpAccept answers -23, closes the first handle,
// checks that the closed handle answers -9 to netRead, netWrite and sendFd,
// and waits for the freed slot to take a connection from the backlog under a
// handle of its own. Exit 0 is a pass, 2 says the kernel refused rings (the
// section's skip), and 1 is a failure, with its line.
import {
  NET_LISTEN_RING,
  netClose,
  netLocalPort,
  netRead,
  netRingState,
  netWrite,
  pollAdd,
  pollCreate,
  pollWait,
  sendFd,
  tcpAccept,
  tcpListenFlags,
} from "nish:net"

/** The connections the client holds open. */
const CLIENTS: i32 = 800
/** The token the listener is reported under; a slot handle is never negative. */
const LISTENER: i32 = -1
/** The lowest slot handle; every handle below it is a descriptor. */
const SLOT_BASE: i32 = 1048576

export const main = (): i32 => {
  const listener: i32 = tcpListenFlags("127.0.0.1", 0, 4096, NET_LISTEN_RING)
  if (listener < 0) {
    console.log(`tcpListenFlags failed with ${listener}`)
    return 1
  }
  const state: i32 = netRingState()
  if (state !== 1) {
    console.log(`rings refused: ${state}`)
    return 2
  }
  console.log(`port ${netLocalPort(listener)}`)
  const loop: i32 = pollCreate()
  pollAdd(loop, listener, 1, LISTENER)
  const ready: i32[] = new Array<i32>(64)
  const peer: u8[] = new Array<u8>(18)
  const buf: u8[] = new Array<u8>(8)
  let first: i32 = -1
  let accepted: i32 = 0
  let last: i32 = -11
  while (last !== -23) {
    const n: i32 = pollWait(loop, ready, 10000)
    if (n <= 0) {
      console.log(`pollWait answered ${n} with ${accepted} accepted and no -23`)
      return 1
    }
    last = tcpAccept(listener, peer)
    while (last >= 0) {
      if (last < SLOT_BASE) {
        console.log(`a connection came back as descriptor ${last}`)
        return 1
      }
      first = first < 0 ? last : first
      accepted += 1
      last = tcpAccept(listener, peer)
    }
    if (last !== -11 && last !== -23) {
      console.log(`tcpAccept answered ${last} after ${accepted}`)
      return 1
    }
  }
  if (accepted >= CLIENTS || accepted < 32) {
    console.log(`the set took ${accepted} of ${CLIENTS} before -23`)
    return 1
  }
  if (netClose(first) !== 0) {
    console.log(`netClose of ${first} failed`)
    return 1
  }
  const read: i32 = netRead(first, buf, 0, 8)
  const wrote: i32 = netWrite(first, buf, 0, 1)
  const passed: i32 = sendFd(first, 0, buf, 0, 1)
  if (read !== -9 || wrote !== -9 || passed !== -9) {
    console.log(`the closed handle answered netRead ${read}, netWrite ${wrote}, sendFd ${passed}`)
    return 1
  }
  let next: i32 = tcpAccept(listener, peer)
  while (next < 0) {
    if (next !== -11 && next !== -23) {
      console.log(`tcpAccept after the close answered ${next}`)
      return 1
    }
    const n: i32 = pollWait(loop, ready, 10000)
    if (n <= 0) {
      console.log(`no connection took the freed slot`)
      return 1
    }
    next = tcpAccept(listener, peer)
  }
  if (next === first || next < SLOT_BASE) {
    console.log(`the freed slot came back as ${next}, the closed handle was ${first}`)
    return 1
  }
  console.log(`took ${accepted} connections, answered -23, then reused the freed slot`)
  return 0
}
