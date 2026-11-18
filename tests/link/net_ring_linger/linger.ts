// Http1Server's lingering close on a ring listener (WP63, NURING-39).
// tests/run.js's `net_ring` section runs this program under this directory's
// `client.mjs`, which sends a request line Http1Server refuses and keeps
// sending until it reads the end of the stream. The server answers 400, shuts its write side
// with netShutdown and drains what the client still sends, so the client
// reads the whole response and then the end of the stream, not a reset. Once
// the client ends its own side the slot closes and the program exits.
// Before netShutdown had a slot path it answered -9 here, Http1Server closed
// at once with the client's bytes unread, and the client got a reset.
// The program also checks the slot answers: netMss -1, netShutdown -22 for a
// `how` past 2, netWrite -32 once the write side is shut, and netShutdown -9
// on the handle once closed. Exit 0 is a pass, 2 says the kernel refused rings,
// 1 is a failure, with its line.
import {
  NET_LISTEN_RING,
  netLocalPort,
  netMss,
  netRingState,
  netShutdown,
  netWrite,
  pollAdd,
  pollCreate,
  pollModify,
  pollWait,
  tcpListenFlags,
} from "nish:net"
import {
  H1_DONE,
  H1_ERROR,
  H1_NEED_MORE,
  H1_POOL_FULL,
  H1_WANT_READ,
  H1_WANT_WRITE,
  Http1Config,
  Http1Server,
} from "nish/net/http1-server"

/** The listener's token; a connection's token is its slot. */
const LISTENER: i32 = -1
/** One byte for the write a shut write side refuses. */
const BYTE: readonly u8[] = [0x61]

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
  const server = new Http1Server(new Http1Config(), listener, 4)
  const loop: i32 = pollCreate()
  const ready: i32[] = new Array<i32>(16)
  pollAdd(loop, listener, H1_WANT_READ, LISTENER)
  console.log(`port ${netLocalPort(listener)}`)
  let handle: i32 = -1
  while (true) {
    const n: i32 = pollWait(loop, ready, 30000)
    if (n <= 0) {
      console.log(`pollWait answered ${n}`)
      return 1
    }
    for (let k: i32 = 0; k < n; k++) {
      const slot: i32 = ready[2 * k]
      if (slot === LISTENER) {
        let next: i32 = server.accept()
        while (next >= 0 || next === H1_POOL_FULL) {
          if (next >= 0) {
            handle = server.fd(next)
            const mss: i32 = netMss(handle)
            if (mss !== -1) {
              console.log(`netMss answered ${mss} for a slot`)
              return 1
            }
            const bad: i32 = netShutdown(handle, 3)
            if (bad !== -22) {
              console.log(`netShutdown(handle, 3) on a slot answered ${bad}`)
              return 1
            }
            pollAdd(loop, handle, H1_WANT_READ, next)
          }
          next = server.accept()
        }
      } else if (server.holds(slot)) {
        let wants: i32 = (ready[2 * k + 1] & 5) !== 0 ? server.readable(slot) : server.writable(slot)
        let event: i32 = server.next(slot)
        while (event !== H1_NEED_MORE && event !== H1_ERROR) {
          event = server.next(slot)
        }
        wants = server.flush(slot)
        if ((wants & H1_DONE) !== 0) {
          const late: i32 = netWrite(handle, BYTE, 0, 1)
          if (late !== -32) {
            console.log(`netWrite after the write side was shut answered ${late}`)
            return 1
          }
          server.close(slot)
          const after: i32 = netShutdown(handle, 1)
          if (after !== -9) {
            console.log(`netShutdown on a closed slot answered ${after}`)
            return 1
          }
          console.log("linger: closed")
          return 0
        } else if (server.rearm(slot, wants)) {
          pollModify(loop, server.fd(slot), wants & (H1_WANT_READ | H1_WANT_WRITE), slot)
        }
      }
    }
  }
}
