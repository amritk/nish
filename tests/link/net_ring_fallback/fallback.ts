// The process-wide fallback (WP63 S2, §5.4). tests/run.js's `net_ring` section
// runs this program under `deny.c`, a seccomp filter that makes io_uring_setup
// answer EPERM. A `NET_LISTEN_RING` listen must still succeed, netRingState()
// must answer -1, and the listener must serve a connection as a descriptor:
// connected, accepted below 2^20 and echoed through the poll loop. Exit 0 is a
// pass and 1 a failure, with its line.
import {
  NET_LISTEN_RING,
  connectResult,
  netAddress,
  netClose,
  netLocalPort,
  netRead,
  netRingState,
  netWrite,
  pollAdd,
  pollCreate,
  pollWait,
  tcpAccept,
  tcpConnect,
  tcpListenFlags,
} from "nish:net"

/** The lowest slot handle; every handle below it is a descriptor. */
const SLOT_BASE: i32 = 1048576

/** Waits up to five seconds for `fd` to be ready for `events`, and answers whether it was. */
const waitFor = (fd: i32, events: i32): boolean => {
  const loop: i32 = pollCreate()
  pollAdd(loop, fd, events, fd)
  const ready: i32[] = new Array<i32>(8)
  const n: i32 = pollWait(loop, ready, 5000)
  netClose(loop)
  return n > 0
}

export const main = (): i32 => {
  const before: i32 = netRingState()
  const listener: i32 = tcpListenFlags("127.0.0.1", 0, 16, NET_LISTEN_RING)
  if (listener < 0) {
    console.log(`tcpListenFlags failed with ${listener}`)
    return 1
  }
  const state: i32 = netRingState()
  if (before !== 0 || state !== -1) {
    console.log(`netRingState answered ${before} before the listen and ${state} after it, not 0 and -1`)
    return 1
  }
  const addr: u8[] = new Array<u8>(18)
  if (netAddress(addr, "127.0.0.1", netLocalPort(listener)) < 0) {
    console.log("netAddress failed")
    return 1
  }
  const client: i32 = tcpConnect(addr)
  if (client < 0 || !waitFor(client, 2) || connectResult(client) !== 0) {
    console.log(`the connection to the fallback listener failed: ${client}`)
    return 1
  }
  if (!waitFor(listener, 1)) {
    console.log("the fallback listener never became readable")
    return 1
  }
  const peer: u8[] = new Array<u8>(18)
  const conn: i32 = tcpAccept(listener, peer)
  if (conn < 0 || conn >= SLOT_BASE) {
    console.log(`the fallback listener accepted ${conn}, not a descriptor`)
    return 1
  }
  const ping: u8[] = [112, 105, 110, 103]
  const buf: u8[] = new Array<u8>(8)
  if (netWrite(client, ping, 0, 4) !== 4 || !waitFor(conn, 1) || netRead(conn, buf, 0, 8) !== 4) {
    console.log("the bytes did not reach the accepted descriptor")
    return 1
  }
  netClose(conn)
  netClose(client)
  netClose(listener)
  console.log(`rings refused with ${state}; served descriptor ${conn}`)
  return 0
}
