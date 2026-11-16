// A loop full of ready ring slots still reports its descriptors (WP63 S2,
// NURING-18). tests/run.js's `net_ring` section runs this program under
// `client.mjs`'s `hold` mode, which opens 80 connections and holds them. The
// program accepts all 80 into ring slots and adds each to one loop for reading
// and writing, so every slot is ready to write on every wait: more than the 64
// a wait reports. It adds one descriptor beside them, a socket connecting to a
// descriptor listener of its own, which turns writable once it has connected.
// A wait that takes all its room from the slots never asks the kernel's epoll
// set and never reports that socket, as it would never report `signalFd()`.
// The program waits with room for 64, then with room for one, and each time
// requires the socket within a few waits, and, with room for one, a slot as
// well. Exit 0 is a pass, 2 says the kernel refused rings, 1 is a failure,
// with its line.
import {
  NET_LISTEN_RING,
  netAddress,
  netLocalPort,
  netRingState,
  pollAdd,
  pollCreate,
  pollWait,
  tcpAccept,
  tcpConnect,
  tcpListen,
  tcpListenFlags,
} from "nish:net"

/** The connections the client holds open. */
const PEERS: i32 = 80
/** The token the ring listener is reported under. */
const LISTENER: i32 = -1
/** The token the descriptor socket is reported under. */
const SOCKET: i32 = -2
/** The waits the socket must be reported within. */
const WAITS: i32 = 4

/** How many of `waits` waits on `loop`, with room for `room` entries, it takes to see `want`; -1 if it never comes. */
const seen = (loop: i32, room: i32, want: i32): i32 => {
  const ready: i32[] = new Array<i32>(room * 2)
  for (let w: i32 = 0; w < WAITS; w++) {
    const n: i32 = pollWait(loop, ready, 1000)
    for (let i: i32 = 0; i < n; i++) {
      if (want === SOCKET ? ready[2 * i] === SOCKET : ready[2 * i] >= 0) {
        return w
      }
    }
  }
  return -1
}

export const main = (): i32 => {
  const listener: i32 = tcpListenFlags("127.0.0.1", 0, 128, NET_LISTEN_RING)
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
  const ready: i32[] = new Array<i32>(16)
  const peer: u8[] = new Array<u8>(18)
  let accepted: i32 = 0
  while (accepted < PEERS) {
    const n: i32 = pollWait(loop, ready, 30000)
    if (n <= 0) {
      console.log(`pollWait answered ${n} after ${accepted} connections`)
      return 1
    }
    let h: i32 = tcpAccept(listener, peer)
    while (h >= 0) {
      const added: i32 = pollAdd(loop, h, 3, h)
      if (added !== 0) {
        console.log(`pollAdd answered ${added} for a slot`)
        return 1
      }
      accepted++
      h = tcpAccept(listener, peer)
    }
    if (h !== -11) {
      console.log(`tcpAccept answered ${h} after ${accepted}`)
      return 1
    }
  }
  const plain: i32 = tcpListen("127.0.0.1", 0, 4)
  const addr: u8[] = new Array<u8>(18)
  netAddress(addr, "127.0.0.1", netLocalPort(plain))
  const fd: i32 = tcpConnect(addr)
  if (plain < 0 || fd < 0) {
    console.log(`the descriptor listener answered ${plain} and the connect ${fd}`)
    return 1
  }
  pollAdd(loop, fd, 2, SOCKET)
  const wide: i32 = seen(loop, 64, SOCKET)
  if (wide < 0) {
    console.log(`with ${PEERS} slots ready, ${WAITS} waits with room for 64 never reported the descriptor`)
    return 1
  }
  const narrow: i32 = seen(loop, 1, SOCKET)
  if (narrow < 0) {
    console.log(`with ${PEERS} slots ready, ${WAITS} waits with room for one never reported the descriptor`)
    return 1
  }
  if (seen(loop, 1, 0) < 0) {
    console.log(`with the descriptor ready, ${WAITS} waits with room for one never reported a slot`)
    return 1
  }
  console.log(`starve: the descriptor came after ${wide} and ${narrow} waits beside ${PEERS} ready slots`)
  return 0
}
