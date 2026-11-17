// `nish/net/handler` on io_uring slots (WP63 S4). tests/run.js's
// `net_handler_ring` section starts this program under a descriptor limit of
// 32, which bounds the slots of a ring and the rings the process can make, and
// `client.mjs` opens 800 keep-alive connections to the port it prints, more
// than the set can take, each sending one `GET /`. With `HandlerLimits.ring`
// set and 4,096 slots, the handler must answer each connection it takes on a
// slot handle, stop taking at the set's size, where tcpAccept answers -23
// (ENFILE), and rest rather than spin: `resting()` must be seen true while the
// count climbs to the set's size, which only an accept that ended on -23 (or
// -24 or ENOMEM, neither of which a slot set under this limit meets) sets.
// When the program prints `full`, the client ends one connection, and the
// handler must close its end and take a waiting connection into the freed
// slot. A full set's listener is not readable, so the -23 a burst of accepts
// ends on is the only one the handler sees; the rest it starts is HANDLER-10's,
// which a close ends early (that path is proven on descriptors, in turns that
// do not wait, by net_handler_rest_close). The set must hold at least
// `HELD_FLOOR` connections, twice the descriptor limit: a handler on
// descriptors holds fewer than 32 under it, and one on a single ring holds at
// most 32 slots, so only a set that grew past one ring (each costs two
// descriptors, its ring and its eventfd) meets the floor. Measured: 416 held,
// 13 rings of 32 slots, in three of three runs. Exit 0 is a pass, 2 says the kernel
// refused rings (the section's skip), and 1 is a failure, with its line.
import { HandlerLimits, HttpHandler, HttpRequest } from "nish/net/handler"
import { Router, RouterLimits } from "nish/net/router"
import { netClose, netLocalPort, netRingState } from "nish:net"

/** The fewest connections the set must hold: more than one ring's 32 slots. */
const HELD_FLOOR: i32 = 64
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

  // Take connections until the count holds still for half a second, looking
  // after each turn for the rest the -23 that ends the set's last burst starts.
  let answered: i32 = 0
  let held: i32 = 0
  let still: i32 = 0
  let rested: boolean = false
  const deadline: i64 = monotonicNanos() + toI64(60000) * toI64(1000000)
  while (still < 25 && monotonicNanos() < deadline) {
    h.wait(TURN)
    rested = rested || h.resting()
    answered += answer(h)
    const now: i32 = h.connections()
    still = now === held && now > 0 ? still + 1 : 0
    held = now
  }
  if (held < HELD_FLOOR || held >= CLIENTS) {
    console.log(`the handler held ${held} of ${CLIENTS} connections, fewer than ${HELD_FLOOR} or all`)
    return 1
  }
  if (!rested) {
    console.log(`the handler held ${held} of ${CLIENTS} connections and never rested: -23 did not rest the listener`)
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

  // Full, the handler takes nothing more however many turns pass.
  for (let k: i32 = 0; k < 5; k++) {
    h.wait(TURN)
  }
  if (h.connections() !== held) {
    console.log(`five more turns left ${h.connections()} of ${held} connections`)
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
