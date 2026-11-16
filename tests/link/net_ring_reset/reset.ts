// A slot whose peer reset it refuses a write, as a descriptor's send does
// (WP63 S2, NURING-23). tests/run.js's `net_ring` section runs this program
// under `client.mjs`'s `reset` mode, which sends five bytes and then resets
// its connection. The program reads until netRead answers the reset, and a
// netWrite after it must answer a negative errno, not a count of bytes queued
// for a peer that is gone. Exit 0 is a pass, 2 says the kernel refused rings,
// 1 is a failure, with its line.
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
  tcpAccept,
  tcpListenFlags,
} from "nish:net"

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
      console.log(`pollWait answered ${n} waiting for a connection`)
      return 1
    }
    h = tcpAccept(listener, peer)
    if (h < 0 && h !== -11) {
      console.log(`tcpAccept answered ${h}`)
      return 1
    }
  }
  pollAdd(loop, h, 1, h)
  const buf: u8[] = new Array<u8>(64)
  let got: i32 = -11
  while (got >= 0 || got === -11) {
    const n: i32 = pollWait(loop, ready, 30000)
    if (n <= 0) {
      console.log(`pollWait answered ${n} waiting for the client's reset`)
      return 1
    }
    got = netRead(h, buf, 0, toI32(buf.length))
    if (got === 0) {
      console.log("netRead answered 0, an orderly end, where the client reset")
      return 1
    }
  }
  const sent: i32 = netWrite(h, buf, 0, toI32(buf.length))
  if (sent >= 0) {
    console.log(`after netRead answered ${got}, netWrite answered ${sent}, not an errno`)
    return 1
  }
  netClose(h)
  console.log(`reset: netRead answered ${got} and netWrite ${sent}`)
  return 0
}
