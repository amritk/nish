// `nish/net/handler` when an accept fails for want of descriptors (EMFILE).
// The program uses up its own descriptors, leaves one for a client to
// connect with, and the connection waits in the listener's backlog with no
// descriptor to accept it into. The listener stays readable, so a handler
// that kept it in the loop would answer every `wait` at once; it rests the
// listener instead, and takes the connection once a descriptor is free.
import { HandlerLimits, HttpHandler } from "nish/net/handler"
import { Router, RouterLimits } from "nish/net/router"
import {
  connectResult,
  netAddress,
  netClose,
  netLocalPort,
  pollAdd,
  pollCreate,
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

export const main = (): i32 => {
  const failures: i32[] = [0]
  const router = new Router(new RouterLimits())
  router.add("GET", "/")
  const listener: i32 = tcpListen("127.0.0.1", 0, 8)
  const h = new HttpHandler(new HandlerLimits(), listener, router)
  const addr: u8[] = new Array<u8>(18)
  netAddress(addr, "127.0.0.1", netLocalPort(listener))
  const clientLoop: i32 = pollCreate()
  const ready: i32[] = new Array<i32>(2)

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
  const client: i32 = tcpConnect(addr)
  pollAdd(clientLoop, client, 2, ZERO)
  check(
    failures,
    "a client connects with the last descriptor",
    client >= 0 && pollWait(clientLoop, ready, 5000) === 1 && connectResult(client) === 0
  )

  const start: i64 = monotonicNanos()
  for (let k: i32 = 0; k < 5; k++) {
    h.wait(toI32(20))
  }
  const elapsedMs: i64 = (monotonicNanos() - start) / toI64(1000000)
  check(failures, "with no descriptor to accept into, the handler holds no connection", h.connections() === 0)
  check(failures, "and its turns wait out their timeout rather than spin", elapsedMs >= toI64(60))

  netClose(held[held.length - 1])
  held.pop()
  const deadline: i64 = monotonicNanos() + toI64(5000) * toI64(1000000)
  while (h.connections() === 0 && monotonicNanos() < deadline) {
    h.wait(toI32(20))
  }
  check(failures, "once a descriptor is free, the waiting connection is taken", h.connections() === 1)

  for (let k: i32 = 0; k < toI32(held.length); k++) {
    netClose(held[k])
  }
  netClose(client)
  netClose(clientLoop)
  return failures[0] === 0 ? 0 : 1
}
