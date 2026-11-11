// `HttpHandler.wait` with a request left queued, over loopback.
//
//   1. A handler that never called `deferSends` blocks for its whole timeout
//      while a request it has queued waits to be taken: the queue is the
//      program's, and a turn that returned at once would spin its loop.
//   2. The same request on a handler that called `deferSends` returns at
//      once, because a send `flush` makes can let a parked request in.
//   3. Taken and answered, the request's response reaches the client whole.
import { HttpHandler, HandlerLimits } from "nish/net/handler"
import { Router, RouterLimits } from "nish/net/router"
import {
  connectResult,
  netAddress,
  netClose,
  netLocalPort,
  netRead,
  netWrite,
  pollAdd,
  pollCreate,
  pollRemove,
  pollWait,
  tcpConnect,
  tcpListen,
} from "nish:net"
import { monotonicNanos } from "nish:process"
import { ascii, ZERO } from "../net_tls_record_common/bytes"

const FIVE_SECONDS: i64 = 5000000000
const MILLISECOND: i64 = 1000000
/** The timeout each checked `wait` is given, in milliseconds. */
const TIMEOUT: i32 = 300

const handler = (listener: i32): HttpHandler => {
  const router = new Router(new RouterLimits())
  router.add("GET", "/")
  const limits = new HandlerLimits()
  limits.slots = 4
  return new HttpHandler(limits, listener, router)
}

/** A connected loopback client of the handler listening on `port`. */
const connect = (port: i32): i32 => {
  const addr: u8[] = new Array<u8>(18)
  netAddress(addr, "127.0.0.1", port)
  const fd: i32 = tcpConnect(addr)
  const loop: i32 = pollCreate()
  const ready: i32[] = new Array<i32>(2)
  pollAdd(loop, fd, 2, ZERO)
  if (pollWait(loop, ready, 5000) !== 1 || connectResult(fd) !== 0) {
    panic("connect failed")
  }
  pollRemove(loop, fd)
  netClose(loop)
  return fd
}

/** Sends one GET and turns `h` until it is queued; false after five seconds. */
const queueOne = (h: HttpHandler, fd: i32): boolean => {
  const bytes: u8[] = ascii("GET / HTTP/1.1\r\nHost: x\r\n\r\n")
  if (netWrite(fd, bytes, ZERO, toI32(bytes.length)) !== toI32(bytes.length)) {
    return false
  }
  const deadline: i64 = monotonicNanos() + FIVE_SECONDS
  while (monotonicNanos() < deadline) {
    if (h.wait(toI32(10)) > 0) {
      return true
    }
  }
  return false
}

/** How long one `wait(TIMEOUT)` took, in milliseconds. */
const timedWait = (h: HttpHandler): i64 => {
  const start: i64 = monotonicNanos()
  h.wait(TIMEOUT)
  return (monotonicNanos() - start) / MILLISECOND
}

export const main = (): i32 => {
  const plainListener: i32 = tcpListen("127.0.0.1", 0, 16)
  const plain: HttpHandler = handler(plainListener)
  const plainFd: i32 = connect(netLocalPort(plainListener))
  if (!queueOne(plain, plainFd)) {
    console.log("plain: the request was never queued")
    return 1
  }
  const plainMs: i64 = timedWait(plain)
  console.log(`plain: a queued request, wait(${TIMEOUT}) blocked its timeout: ${plainMs >= toI64(TIMEOUT - 50)}`)
  console.log(`plain: still queued: ${plain.ready()}`)

  const req = plain.take()
  const body: u8[] = ascii("hello")
  plain.send(req, 200, ascii("text/plain"), body, ZERO, toI32(body.length))
  const buf: u8[] = new Array<u8>(512)
  let got: i32 = 0
  const deadline: i64 = monotonicNanos() + FIVE_SECONDS
  while (monotonicNanos() < deadline && got < 5) {
    plain.wait(toI32(10))
    const n: i32 = netRead(plainFd, buf, got, toI32(buf.length) - got)
    if (n > 0) {
      got += n
    }
    if (got >= 4 && buf[got - 1] === 111 && buf[got - 5] === 104) {
      break
    }
  }
  console.log(`plain: answered: ${got > 0 && buf[9] === 50 && buf[10] === 48 && buf[11] === 48}`)

  const deferListener: i32 = tcpListen("127.0.0.1", 0, 16)
  const deferring: HttpHandler = handler(deferListener)
  deferring.deferSends()
  const deferFd: i32 = connect(netLocalPort(deferListener))
  if (!queueOne(deferring, deferFd)) {
    console.log("deferring: the request was never queued")
    return 1
  }
  const deferMs: i64 = timedWait(deferring)
  console.log(`deferring: a queued request, wait(${TIMEOUT}) returned at once: ${deferMs < toI64(TIMEOUT - 50)}`)
  return 0
}
