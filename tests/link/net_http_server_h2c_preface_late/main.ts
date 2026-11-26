// A whole preface on a listener that takes h2c peers, then a wait past
// `prefaceTimeout`: the h2c carrier adopts the slot past its preface, so
// neither carrier's preface bound closes it, and a request sent after the
// wait is served as HTTP/2.
import { HttpServerLimits, HttpServerRequest } from "nish/net/http-server"
import { H2_FLAG_END_STREAM } from "nish/net/http2-frame"
import { getOf, Wire } from "../net_http2/peer"
import { Preface } from "../net_http_server_h2c_preface/rig"

export const main = (): i32 => {
  const limits = new HttpServerLimits()
  limits.prefaceTimeout = 200
  limits.idleTimeout = 60000
  const p = new Preface(limits, true)
  const wire = new Wire()
  const none: i32[] = []
  const noValues: i64[] = []
  wire.preface()
  wire.settings(none, noValues)
  p.send(wire.take())
  // Three prefaceTimeouts pass, the server turning throughout.
  const start: i64 = monotonicNanos()
  while (monotonicNanos() - start < toI64(600) * toI64(1000000)) {
    p.read(1000000, 1)
  }
  console.log(`after 600 ms: ended ${p.ended}, SETTINGS back ${p.got.length >= 9 && toI32(p.got[3]) === 4}`)
  wire.headers(toI32(1), getOf("/late"), H2_FLAG_END_STREAM)
  p.send(wire.take())
  const req: HttpServerRequest = p.take()
  console.log(`version ${req.version}, /late ${req.pathIs("/late")}`)
  return 0
}
