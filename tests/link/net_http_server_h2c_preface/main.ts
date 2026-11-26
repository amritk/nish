// An h2c peer on an HTTP/1.1 listener that takes them: its preface, sent in
// two writes, moves the connection to the h2c carrier, which answers with its
// SETTINGS and serves the request as HTTP/2.
import { HttpServerLimits, HttpServerRequest } from "nish/net/http-server"
import { H2_FLAG_END_STREAM } from "nish/net/http2-frame"
import { getOf, Wire } from "../net_http2/peer"
import { ascii, ZERO } from "../net_tls_record_common/bytes"
import { Preface } from "./rig"

export const main = (): i32 => {
  const p = new Preface(new HttpServerLimits(), true)
  const wire = new Wire()
  const none: i32[] = []
  const noValues: i64[] = []
  wire.preface()
  wire.settings(none, noValues)
  wire.headers(toI32(1), getOf("/users/7"), H2_FLAG_END_STREAM)
  const all: u8[] = wire.take()
  // The first ten bytes of the preface, then a wait: the slot holds them and decides nothing.
  const first: u8[] = new Array<u8>(10)
  for (let i: i32 = 0; i < 10; i++) {
    first[i] = all[i]
  }
  p.send(first)
  p.turn(20)
  p.read(1, 5)
  console.log(`after ten bytes: ${p.got.length} bytes back, ended ${p.ended}`)
  const rest: u8[] = new Array<u8>(toI32(all.length) - 10)
  for (let i: i32 = 10; i < toI32(all.length); i++) {
    rest[i - 10] = all[i]
  }
  p.send(rest)
  const req: HttpServerRequest = p.take()
  console.log(`version ${req.version}, GET ${req.methodIs("GET")}, /users/7 ${req.pathIs("/users/7")}`)
  const body: u8[] = ascii("hi\n")
  p.h.send(req, 200, ascii("text/plain"), body, ZERO, toI32(body.length))
  p.read(9, 200)
  // An HTTP/2 frame's type is its fourth byte: the server's first is SETTINGS, 4.
  console.log(`first frame type ${p.got.length >= 9 ? toI32(p.got[3]) : -1}`)
  return 0
}
