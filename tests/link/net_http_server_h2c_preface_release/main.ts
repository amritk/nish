// `Http1Server.release`, which the façade calls to hand a socket to the h2c
// carrier: it answers -1 for an unknown or free slot and for one that has
// read, which keeps its socket; a slot accepted and not yet read gives its
// socket up and is free, so the next accept takes it again.
import { netAddress, netClose, netLocalPort, netWrite, tcpConnect, tcpListen } from "nish:net"
import { Http1Config, Http1Server } from "nish/net/http1-server"
import { ascii, ZERO } from "../net_tls_record_common/bytes"

/** Accepts the next connection, trying for two seconds a millisecond at a time. */
const acceptOne = (h1: Http1Server): i32 => {
  for (let k: i32 = 0; k < 2000; k++) {
    const slot: i32 = h1.accept()
    if (slot !== -11) {
      return slot
    }
    const start: i64 = monotonicNanos()
    while (monotonicNanos() - start < toI64(1000000)) {}
  }
  return -11
}

export const main = (): i32 => {
  const listener: i32 = tcpListen("127.0.0.1", 0, 8)
  const h1 = new Http1Server(new Http1Config(), listener, toI32(2))
  const addr: u8[] = new Array<u8>(18)
  netAddress(addr, "127.0.0.1", netLocalPort(listener))
  console.log(`unknown: ${h1.release(toI32(7))}, before any accept: ${h1.release(ZERO)}`)
  const a: i32 = tcpConnect(addr)
  const first: i32 = acceptOne(h1)
  const fd: i32 = h1.release(first)
  console.log(`unread slot ${first}: a socket ${fd >= 0}, again ${h1.release(first)}, held ${h1.holds(first)}`)
  netClose(fd)
  const b: i32 = tcpConnect(addr)
  const second: i32 = acceptOne(h1)
  console.log(`next accept takes slot ${second}`)
  const head: u8[] = ascii("GET / HTTP/1.1\r\nHost: t\r\n\r\n")
  if (netWrite(b, head, ZERO, toI32(head.length)) !== toI32(head.length)) {
    panic("short write")
  }
  const start: i64 = monotonicNanos()
  while (monotonicNanos() - start < toI64(50) * toI64(1000000)) {}
  h1.readable(second)
  console.log(`read slot ${second}: ${h1.release(second)}, held ${h1.holds(second)}`)
  netClose(a)
  netClose(b)
  return 0
}
