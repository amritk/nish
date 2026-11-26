// A `NET_LISTEN_RING` listener past RLIMIT_NOFILE (WP63 S2). tests/run.js's
// `net_ring` section starts this program under a descriptor limit of 1,024
// and `client.mjs` opens 3,000 connections to the port it prints, each
// sending five bytes. The program echoes them through pollWait, netRead and
// netWrite. With all 3,000 open and echoed it counts /proc/self/fd, then
// closes each one at its end of stream. Exit 0 is a pass, 2 says the kernel
// refused rings (the section's skip), and 1 is a failure, with its line.
// With NET_RING_WIDE=1 it listens with NET_LISTEN_RING_WIDE as well.
import { readdirSync } from "nish:fs"
import {
  NET_LISTEN_RING,
  NET_LISTEN_RING_WIDE,
  netClose,
  netLocalPort,
  netRead,
  netRingState,
  netWrite,
  pollAdd,
  pollCreate,
  pollWait,
  tcpAccept,
  tcpListenFlags,
} from "nish:net"
import { getenv } from "nish:process"

/** The connections the client opens. */
const CLIENTS: i32 = 3000
/** The bytes each one sends, and is sent back. */
const EACH: i32 = 5
/** The token the listener is reported under; a slot handle is never negative. */
const LISTENER: i32 = -1

export const main = (): i32 => {
  const wide: boolean = (getenv("NET_RING_WIDE") ?? "") === "1"
  const flags: i32 = wide ? NET_LISTEN_RING | NET_LISTEN_RING_WIDE : NET_LISTEN_RING
  const listener: i32 = tcpListenFlags("127.0.0.1", 0, 4096, flags)
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
  const ready: i32[] = new Array<i32>(128)
  const peer: u8[] = new Array<u8>(18)
  const buf: u8[] = new Array<u8>(64)
  let accepted: i32 = 0
  let echoed: i32 = 0
  let closed: i32 = 0
  let lowest: i32 = 2147483647
  let descriptors: i32 = -1
  while (closed < CLIENTS) {
    const n: i32 = pollWait(loop, ready, 10000)
    if (n <= 0) {
      console.log(`pollWait answered ${n} with ${accepted} accepted, ${echoed} bytes echoed, ${closed} closed`)
      return 1
    }
    for (let k: i32 = 0; k < n; k++) {
      const token: i32 = ready[2 * k]
      if (token === LISTENER) {
        let h: i32 = tcpAccept(listener, peer)
        while (h >= 0) {
          accepted += 1
          lowest = h < lowest ? h : lowest
          const added: i32 = pollAdd(loop, h, 1, h)
          if (added !== 0) {
            console.log(`pollAdd of slot handle ${h} answered ${added}`)
            return 1
          }
          h = tcpAccept(listener, peer)
        }
        if (h !== -11) {
          console.log(`tcpAccept answered ${h} after ${accepted}`)
          return 1
        }
        continue
      }
      const got: i32 = netRead(token, buf, 0, toI32(buf.length))
      if (got > 0) {
        const sent: i32 = netWrite(token, buf, 0, got)
        if (sent !== got) {
          console.log(`netWrite of ${got} answered ${sent}`)
          return 1
        }
        echoed += got
        if (echoed === CLIENTS * EACH) {
          const fds: string[] | null = readdirSync("/proc/self/fd")
          descriptors = fds === null ? -1 : toI32(fds.length)
        }
      } else if (got === 0) {
        netClose(token)
        closed += 1
      } else if (got !== -11) {
        console.log(`netRead answered ${got}`)
        return 1
      }
    }
  }
  netClose(loop)
  netClose(listener)
  if (lowest < 1048576) {
    console.log(`a connection came back as descriptor ${lowest}`)
    return 1
  }
  if (descriptors < 0 || descriptors >= 64) {
    console.log(`${descriptors} entries in /proc/self/fd with ${CLIENTS} connections open`)
    return 1
  }
  console.log(`served ${accepted} connections with fewer than 64 descriptors`)
  return 0
}
