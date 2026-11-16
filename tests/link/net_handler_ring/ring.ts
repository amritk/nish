// `nish/net/handler` on io_uring slots (WP63 S4). tests/run.js's
// `net_handler_ring` section starts this program under a descriptor limit of
// 32, which bounds the slots of a ring and the rings the process can make, and
// `client.mjs` opens 800 keep-alive connections to the port it prints, more
// than the set can take, each sending one `GET /`. With `HandlerLimits.ring`
// set and 4,096 slots, the handler must answer each connection it takes on a
// slot handle, stop taking at the set's size, where tcpAccept answers -23
// (ENFILE), and rest rather than spin. When the program prints `full`, the
// client ends one connection, and the handler must close its end and take a
// waiting connection into the freed slot. A full set's listener is not
// readable, so the -23 a burst of accepts ends on is the only one the handler
// sees; the rest it starts is HANDLER-10's, which a close ends early (that path
// is proven on descriptors, deterministically, by net_handler_rest_close). Exit
// 0 is a pass, 2 says the kernel refused rings (the section's skip), and 1 is a
// failure, with its line.
import { HandlerLimits, HttpHandler, HttpRequest } from "nish/net/handler"
import { Router, RouterLimits } from "nish/net/router"
import { netClose, netLocalPort, netRingState } from "nish:net"

/** The connections the client opens. */
const CLIENTS: i32 = 800
/** A turn that blocks, in milliseconds. */
const TURN: i32 = 20

/** Answers every whole request the handler holds with an empty 200. */
const answer = (h: HttpHandler): i32 => {
  let n: i32 = 0
  while (h.ready()) {
    const r: HttpRequest = h.take()
    h.empty(r, 200)
    n += 1
  }
  return n
}

export const main = (): i32 => {
  const router = new Router(new RouterLimits())
  router.add("GET", "/")
  const limits = new HandlerLimits()
  limits.ring = true
  limits.slots = 4096
  const listener: i32 = limits.listen("127.0.0.1", 0, 4096, 0)
  if (listener < 0) {
    console.log(`listen failed with ${listener}`)
    return 1
  }
  const state: i32 = netRingState()
  if (state !== 1) {
    console.log(`rings refused: ${state}`)
    return 2
  }
  const h = new HttpHandler(limits, listener, router)
  console.log(`port ${netLocalPort(listener)}`)

  // Take connections until the count holds still for half a second.
  let answered: i32 = 0
  let held: i32 = 0
  let still: i32 = 0
  const deadline: i64 = monotonicNanos() + toI64(60000) * toI64(1000000)
  while (still < 25 && monotonicNanos() < deadline) {
    h.wait(TURN)
    answered += answer(h)
    const now: i32 = h.connections()
    still = now === held && now > 0 ? still + 1 : 0
    held = now
  }
  if (held < 32 || held >= CLIENTS) {
    console.log(`the handler held ${held} of ${CLIENTS} connections`)
    return 1
  }
  // Every connection held has sent its request; let the answers land. A full
  // set under this limit receives slowly, a few slots a turn.
  while (answered < held && monotonicNanos() < deadline) {
    h.wait(TURN)
    answered += answer(h)
  }
  if (answered !== held) {
    console.log(`answered ${answered} requests on ${held} connections`)
    return 1
  }

  // Resting, a turn waits out its timeout rather than return at once.
  const start: i64 = monotonicNanos()
  for (let k: i32 = 0; k < 5; k++) {
    h.wait(TURN)
  }
  const restedMs: i64 = (monotonicNanos() - start) / toI64(1000000)
  if (restedMs < toI64(60) || h.connections() !== held) {
    console.log(`five turns took ${restedMs} ms and left ${h.connections()} of ${held} connections`)
    return 1
  }

  // The client ends one connection once it reads this line.
  console.log("full")
  while (h.connections() === held && monotonicNanos() < deadline) {
    h.wait(TURN)
  }
  if (h.connections() !== held - 1) {
    console.log(`after the client's close the handler held ${h.connections()} of ${held}`)
    return 1
  }
  while (h.connections() < held && monotonicNanos() < deadline) {
    h.wait(TURN)
  }
  if (h.connections() !== held) {
    console.log(`after the close the handler held ${h.connections()} of ${held}: the freed slot was not taken`)
    return 1
  }
  h.drain()
  netClose(listener)
  console.log(`held ${held} connections on slots, answered -23 with a rest, and took the freed slot after a close`)
  return 0
}
