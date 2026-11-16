// A peer the program does not read cannot grow a ring slot's receive queue
// (WP63 S2, NURING-9). tests/run.js's `net_ring` section runs this program
// under `client.mjs`'s `flood` mode, which opens one connection and writes
// 64 MiB into it as fast as the kernel takes them. The program accepts it and
// does not read: it keeps calling pollWait, which takes in what the rings
// have received, until the client stalls and opens a second connection as its
// signal. The client reports how much the kernel took before it stalled, and
// the section checks it is far below 64 MiB. Then the program reads the first
// connection to its end and checks that every byte arrived, so the held
// receive went again. Exit 0 is a pass, 2 says the kernel refused rings, 1 is
// a failure, with its line.
import {
  NET_LISTEN_RING,
  netClose,
  netLocalPort,
  netRead,
  netRingState,
  pollAdd,
  pollCreate,
  pollWait,
  tcpAccept,
  tcpListenFlags,
} from "nish:net"

/** The bytes the client writes into the first connection. */
const TOTAL: i32 = 67108864
/** The token the listener is reported under. */
const LISTENER: i32 = -1

export const main = (): i32 => {
  const listener: i32 = tcpListenFlags("127.0.0.1", 0, 16, NET_LISTEN_RING)
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
  let first: i32 = -1
  let second: i32 = -1
  while (second < 0) {
    const n: i32 = pollWait(loop, ready, 30000)
    if (n <= 0) {
      console.log(`pollWait answered ${n} waiting for the client's signal`)
      return 1
    }
    let h: i32 = tcpAccept(listener, peer)
    while (h >= 0) {
      if (first < 0) {
        first = h
      } else {
        second = h
      }
      h = tcpAccept(listener, peer)
    }
  }
  pollAdd(loop, first, 1, first)
  const buf: u8[] = new Array<u8>(65536)
  let total: i32 = 0
  let open: boolean = true
  while (open) {
    const n: i32 = pollWait(loop, ready, 30000)
    if (n <= 0) {
      console.log(`pollWait answered ${n} with ${total} bytes read`)
      return 1
    }
    let got: i32 = netRead(first, buf, 0, toI32(buf.length))
    while (got > 0) {
      total += got
      got = netRead(first, buf, 0, toI32(buf.length))
    }
    if (got === 0) {
      open = false
    } else if (got !== -11) {
      console.log(`netRead answered ${got} with ${total} bytes read`)
      return 1
    }
  }
  netClose(first)
  netClose(second)
  netClose(loop)
  netClose(listener)
  if (total !== TOTAL) {
    console.log(`read ${total} bytes of ${TOTAL}`)
    return 1
  }
  console.log(`read all ${total} bytes after the hold`)
  return 0
}
