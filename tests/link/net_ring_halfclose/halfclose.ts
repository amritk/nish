// A peer that only stops sending still gets every byte queued for it, and a
// closed loop lets its slots go (WP63 S2). tests/run.js's `net_ring` section
// runs this program under `client.mjs`'s `halfclose` mode, which sends five
// bytes and ends its writing side at once. The program first adds the slot to
// a loop, closes that loop, and checks that a new loop takes the slot, as
// epoll would after a close. Then it reads the client's bytes to their end
// and writes until netWrite answers -11, which the client, holding off its
// reads for a second, makes it do once the kernel's buffers and the slot's
// 256 KiB send area are full, and closes the handle with that area queued.
// The close lingers until the queue is sent: the client counts the bytes and
// opens a second connection, which the program waits for before it exits.
// The section checks the two counts are the same. Exit 0 is a pass, 2 says
// the kernel refused rings, 1 is a failure, with its line.
import {
  NET_LISTEN_RING,
  netClose,
  netLocalPort,
  netRead,
  netRingState,
  netWrite,
  pollAdd,
  pollCreate,
  pollRemove,
  pollWait,
  tcpAccept,
  tcpListenFlags,
} from "nish:net"

/** Past this many bytes with no -11, the client is not holding off. */
const LIMIT: i32 = 268435456
/** The token the listener is reported under. */
const LISTENER: i32 = -1

/** Waits on `loop` until `listener` gives a connection; -1 on a failure. */
const acceptOne = (loop: i32, listener: i32, ready: i32[], peer: u8[]): i32 => {
  let h: i32 = -11
  while (h < 0) {
    const n: i32 = pollWait(loop, ready, 30000)
    if (n <= 0) {
      console.log(`pollWait answered ${n} waiting for a connection`)
      return -1
    }
    h = tcpAccept(listener, peer)
    if (h < 0 && h !== -11) {
      console.log(`tcpAccept answered ${h}`)
      return -1
    }
  }
  return h
}

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
  const h: i32 = acceptOne(loop, listener, ready, peer)
  if (h < 0) {
    return 1
  }
  const gone: i32 = pollCreate()
  pollAdd(gone, h, 1, h)
  netClose(gone)
  const fresh: i32 = pollCreate()
  const added: i32 = pollAdd(fresh, h, 1, h)
  if (added !== 0) {
    console.log(`a slot of a closed loop answered pollAdd ${added}`)
    return 1
  }
  pollRemove(fresh, h)
  netClose(fresh)
  pollAdd(loop, h, 1, h)
  const buf: u8[] = new Array<u8>(64)
  let got: i32 = -11
  while (got !== 0) {
    const n: i32 = pollWait(loop, ready, 30000)
    if (n <= 0) {
      console.log(`pollWait answered ${n} waiting for the client's end`)
      return 1
    }
    got = netRead(h, buf, 0, toI32(buf.length))
    if (got < 0 && got !== -11) {
      console.log(`netRead answered ${got}`)
      return 1
    }
  }
  const chunk: u8[] = new Array<u8>(65536)
  let written: i32 = 0
  let sent: i32 = 0
  while (sent >= 0 && written < LIMIT) {
    sent = netWrite(h, chunk, 0, 65536)
    written += sent > 0 ? sent : 0
  }
  if (sent !== -11) {
    console.log(`netWrite answered ${sent} with ${written} bytes written`)
    return 1
  }
  netClose(h)
  if (acceptOne(loop, listener, ready, peer) < 0) {
    return 1
  }
  console.log(`halfclose: wrote ${written} bytes after the client's end and closed`)
  return 0
}
