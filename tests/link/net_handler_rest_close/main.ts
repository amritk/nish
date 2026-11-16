// `nish/net/handler` ends its accept rest when a connection closes (WP63 S4,
// HANDLER-10). The handler holds one connection, the program uses up its own
// descriptors but for one, and a second client connects with that one, so
// its connection waits in the listener's backlog with no descriptor to accept
// it into: the handler's accept answers -24 and it rests the listener for up
// to 100 ms. The first client then closes. The handler closes its end, which
// frees a descriptor, and must take the waiting connection within turns that
// do not wait (`wait(0)`), all inside those 100 ms, where a rest that only
// timed out would leave it in the backlog.
import { HandlerLimits, HttpHandler } from "nish/net/handler"
import { Router, RouterLimits } from "nish/net/router"
import {
  connectResult,
  netAddress,
  netClose,
  netLocalPort,
  pollAdd,
  pollCreate,
  pollRemove,
  pollWait,
  tcpConnect,
  tcpListen,
} from "nish:net"
import { ZERO } from "../net_tls_record_common/bytes"

/** More descriptors than any limit this test expects to meet. */
const MOST: i32 = 2097152

/** Prints a check's line and counts it in `failures[0]` if it failed. */
const check = (failures: i32[], name: string, ok: boolean): void => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`)
  if (!ok) {
    failures[0] += 1
  }
}

/** Connects to `addr`, waiting in `loop` up to five seconds for the connection; -1 if it fails. */
const connect = (loop: i32, addr: u8[]): i32 => {
  const ready: i32[] = new Array<i32>(2)
  const fd: i32 = tcpConnect(addr)
  const ok: boolean = fd >= 0 && pollAdd(loop, fd, 2, ZERO) === 0 && pollWait(loop, ready, 5000) === 1
  pollRemove(loop, fd)
  return ok && connectResult(fd) === 0 ? fd : -1
}

export const main = (): i32 => {
  const failures: i32[] = [0]
  const router = new Router(new RouterLimits())
  router.add("GET", "/")
  const listener: i32 = tcpListen("127.0.0.1", 0, 8)
  const h = new HttpHandler(new HandlerLimits(), listener, router)
  const addr: u8[] = new Array<u8>(18)
  netAddress(addr, "127.0.0.1", netLocalPort(listener))

  const clientLoop: i32 = pollCreate()
  const first: i32 = connect(clientLoop, addr)
  const deadline: i64 = monotonicNanos() + toI64(5000) * toI64(1000000)
  while (h.connections() === 0 && monotonicNanos() < deadline) {
    h.wait(toI32(20))
  }
  check(failures, "the handler takes the first connection", first >= 0 && h.connections() === 1)

  const held: i32[] = []
  let fd: i32 = pollCreate()
  while (fd >= 0 && toI32(held.length) < MOST) {
    held.push(fd)
    fd = pollCreate()
  }
  if (fd >= 0) {
    panic(`no descriptor limit met in ${MOST} descriptors`)
  }
  netClose(held[held.length - 1])
  held.pop()
  const second: i32 = connect(clientLoop, addr)
  check(failures, "a second client connects with the last descriptor", second >= 0)

  // The listener is readable with no descriptor to accept into: -24, a rest.
  h.wait(toI32(20))
  h.wait(toI32(20))
  check(failures, "with no descriptor free, the second connection waits", h.connections() === 1)

  const start: i64 = monotonicNanos()
  netClose(first)
  let closed: boolean = false
  for (let k: i32 = 0; k < 50 && !(closed && h.connections() === 1); k++) {
    h.wait(toI32(0))
    closed = closed || h.connections() === 0
  }
  const elapsedMs: i64 = (monotonicNanos() - start) / toI64(1000000)
  check(failures, "the handler closes its end of the first connection", closed)
  check(
    failures,
    "and takes the waiting connection in turns that do not wait, before a timed rest would end",
    h.connections() === 1 && elapsedMs < toI64(100)
  )

  for (let k: i32 = 0; k < toI32(held.length); k++) {
    netClose(held[k])
  }
  netClose(second)
  netClose(clientLoop)
  return failures[0] === 0 ? 0 : 1
}
