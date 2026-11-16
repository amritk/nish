// A program cannot queue unbounded sends to a peer that does not read (WP63
// S2, NURING-2). tests/run.js's `net_ring` section runs this program under
// `client.mjs`'s `sink` mode, which opens one connection and reads nothing
// for a second. The program writes 64 MiB into it as fast as netWrite takes
// them. A slot's send area holds 256 KiB, so once the kernel's socket buffers
// are full netWrite answers -11, and the program waits for the slot to be
// writable before it writes the rest. It prints how much it had written at the
// first -11, which the section checks is far below 64 MiB, then reads the
// connection to the client's end, which comes once the client has every byte.
// At the first -11 it also calls netWrite2 with an empty first range, which
// must answer -11 too, as `sendmsg` would, never 0 (NURING-21).
// Exit 0 is a pass, 2 says the kernel refused rings, 1 is a failure, with its
// line.
import {
  NET_LISTEN_RING,
  netClose,
  netLocalPort,
  netRead,
  netRingState,
  netWrite,
  netWrite2,
  pollAdd,
  pollCreate,
  pollModify,
  pollWait,
  tcpAccept,
  tcpListenFlags,
} from "nish:net"

/** The bytes the program writes. */
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
  let h: i32 = -11
  while (h < 0) {
    const n: i32 = pollWait(loop, ready, 30000)
    if (n <= 0) {
      console.log(`pollWait answered ${n} waiting for the client`)
      return 1
    }
    h = tcpAccept(listener, peer)
    if (h < 0 && h !== -11) {
      console.log(`tcpAccept answered ${h}`)
      return 1
    }
  }
  pollAdd(loop, h, 2, h)
  const chunk: u8[] = new Array<u8>(65536)
  const empty: u8[] = new Array<u8>(0)
  let written: i32 = 0
  let first: i32 = -1
  while (written < TOTAL) {
    const left: i32 = TOTAL - written
    const sent: i32 = netWrite(h, chunk, 0, left < 65536 ? left : 65536)
    if (sent > 0) {
      written += sent
    } else if (sent === -11) {
      if (first < 0) {
        first = written
        const both: i32 = netWrite2(h, empty, 0, 0, chunk, 0, 65536)
        if (both !== -11) {
          console.log(`netWrite2 with an empty first range answered ${both} on a full send area`)
          return 1
        }
        console.log("sink: netWrite2 with an empty first range answered -11")
      }
      const n: i32 = pollWait(loop, ready, 30000)
      if (n <= 0) {
        console.log(`pollWait answered ${n} with ${written} bytes written`)
        return 1
      }
    } else {
      console.log(`netWrite answered ${sent} with ${written} bytes written`)
      return 1
    }
  }
  if (first < 0) {
    console.log(`netWrite took all ${TOTAL} bytes and never answered -11`)
    return 1
  }
  pollModify(loop, h, 1, h)
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
  netClose(h)
  netClose(loop)
  netClose(listener)
  console.log(`sink: the first -11 came after ${first} bytes`)
  return 0
}
