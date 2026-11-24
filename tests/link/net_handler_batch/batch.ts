// `HandlerLimits.minEvents` and `maxWaitMs` on io_uring slots (WP63, ring
// batch waits). tests/run.js's `net_handler_batch` section runs this program;
// its exit status is the verdict, 2 saying the kernel refused rings (a counted
// skip) and 1 a failure, with its line.
//
// Three handlers, each on a ring listener of its own, with clients this
// program opens on descriptors:
// - `serve`: minEvents 64 and maxWaitMs 1, the bench's batch. Forty
//   connections each send a `GET /`, and every one must read a 200: the
//   batched loop serves as the default one does.
// - `late`: minEvents 64 and maxWaitMs 400. One connection's request is
//   pending when `wait(3000)` starts; a wait that called `pollWaitBatch` hears
//   the accept at once and then waits the 400 ms for 63 more events, so the
//   turn lasts at least `LATE_FLOOR` and well under its timeout. A `wait`
//   that called `pollWait` returns at once, failing the floor.
// - `prompt`: minEvents 1 and the same maxWaitMs, the control: the same
//   turn must return under `PROMPT_CEILING`, since a minEvents of 1 never
//   batches.
import { HandlerLimits, HttpHandler, HttpRequest } from "nish/net/handler"
import { Router, RouterLimits } from "nish/net/router"
import {
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
  tcpConnect,
} from "nish:net"
import { ascii, ZERO } from "../net_tls_record_common/bytes"

/** The connections `serve` answers. */
const CLIENTS: i32 = 40
/** `late`'s and `prompt`'s maxWaitMs. */
const LATE_WAIT: i32 = 400
/** The shortest turn `late` may take, in milliseconds: its maxWaitMs, less slack for a coarse clock. */
const LATE_FLOOR: i64 = 300
/** The longest turn `prompt` may take, in milliseconds. */
const PROMPT_CEILING: i64 = 200
/** One request, kept open. */
const REQUEST: string = "GET / HTTP/1.1\r\nHost: t\r\n\r\n"

/** A handler on a ring listener of its own, the listener, and the port it listens on. */
class Side {
  h: HttpHandler
  listener: i32
  port: i32
  constructor(h: HttpHandler, listener: i32, port: i32) {
    this.h = h
    this.listener = listener
    this.port = port
  }
}

/** A handler on a ring listener of its own, or null when listen failed. */
const ringHandler = (router: Router, minEvents: i32, maxWaitMs: i32): Side | null => {
  const limits = new HandlerLimits()
  limits.ring = true
  limits.minEvents = minEvents
  limits.maxWaitMs = maxWaitMs
  const listener: i32 = limits.listen("127.0.0.1", 0, 256, 0)
  if (listener < 0) {
    console.log(`listen failed with ${listener}`)
    return null
  }
  return new Side(new HttpHandler(limits, listener, router), listener, netLocalPort(listener))
}

/** Connects to `port` and sends one request, answering the client's descriptor or -1. */
const client = (port: i32): i32 => {
  const addr: u8[] = new Array<u8>(18)
  netAddress(addr, "127.0.0.1", port)
  const fd: i32 = tcpConnect(addr)
  const loop: i32 = pollCreate()
  const ready: i32[] = new Array<i32>(2)
  pollAdd(loop, fd, 2, ZERO)
  const ok: boolean = pollWait(loop, ready, 5000) === 1 && connectResult(fd) === 0
  netClose(loop)
  if (!ok) {
    return -1
  }
  const request: u8[] = ascii(REQUEST)
  netWrite(fd, request, ZERO, toI32(request.length))
  return fd
}

/** Answers every whole request the handler holds with an empty 200. */
const answer = (h: HttpHandler): void => {
  while (h.ready()) {
    const r: HttpRequest = h.take()
    h.empty(r, 200)
  }
}

/** How long, in milliseconds, the first `wait(3000)` takes with one request pending, or -1. */
const firstTurn = (side: Side): i64 => {
  const fd: i32 = client(side.port)
  if (fd < 0) {
    return -1
  }
  const start: i64 = monotonicNanos()
  side.h.wait(3000)
  const took: i64 = (monotonicNanos() - start) / toI64(1000000)
  netClose(fd)
  return took
}

export const main = (): i32 => {
  const router = new Router(new RouterLimits())
  router.add("GET", "/")
  const side: Side | null = ringHandler(router, 64, 1)
  if (side === null) {
    return 1
  }
  const serve: HttpHandler = side.h
  const state: i32 = netRingState()
  if (state !== 1) {
    console.log(`rings refused: ${state}`)
    return 2
  }

  const fds: i32[] = new Array<i32>(CLIENTS)
  for (let k: i32 = 0; k < CLIENTS; k++) {
    fds[k] = client(side.port)
    if (fds[k] < 0) {
      console.log(`serve: client ${k} did not connect`)
      return 1
    }
  }
  const got: boolean[] = new Array<boolean>(CLIENTS)
  const buf: u8[] = new Array<u8>(512)
  let answered: i32 = 0
  const deadline: i64 = monotonicNanos() + toI64(30000) * toI64(1000000)
  while (answered < CLIENTS && monotonicNanos() < deadline) {
    serve.wait(5)
    answer(serve)
    for (let k: i32 = 0; k < CLIENTS; k++) {
      if (!got[k]) {
        const n: i32 = netRead(fds[k], buf, ZERO, toI32(buf.length))
        if (n > 0 && String.fromBytes(buf, ZERO, n).startsWith("HTTP/1.1 200")) {
          got[k] = true
          answered += 1
        }
      }
    }
  }
  if (answered !== CLIENTS) {
    console.log(`serve: ${answered} of ${CLIENTS} connections read a 200`)
    return 1
  }
  for (let k: i32 = 0; k < CLIENTS; k++) {
    netClose(fds[k])
  }
  // A batch waits on one ring set, so each side closes its listener before
  // the next opens one.
  netClose(side.listener)

  const late: Side | null = ringHandler(router, 64, LATE_WAIT)
  if (late === null) {
    return 1
  }
  const lateTook: i64 = firstTurn(late)
  netClose(late.listener)
  if (lateTook < LATE_FLOOR || lateTook >= toI64(2500)) {
    console.log(`late: a turn with one request pending took ${lateTook} ms, not ${LATE_FLOOR} to 2500`)
    return 1
  }
  const prompt: Side | null = ringHandler(router, 1, LATE_WAIT)
  if (prompt === null) {
    return 1
  }
  const promptTook: i64 = firstTurn(prompt)
  netClose(prompt.listener)
  if (promptTook < toI64(0) || promptTook >= PROMPT_CEILING) {
    console.log(`prompt: a turn with one request pending took ${promptTook} ms, not under ${PROMPT_CEILING}`)
    return 1
  }
  console.log(
    `batch: ${CLIENTS} answered at minEvents 64, a pending request held ${LATE_FLOOR}+ ms at maxWaitMs ${LATE_WAIT}, and minEvents 1 did not hold it`
  )
  return 0
}
