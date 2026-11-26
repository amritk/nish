// Two h2c peers on a one-slot listener that takes them: the first moves to
// the h2c carrier and frees its HTTP/1.1 slot, so the second is accepted and
// read, but the h2c carrier's one slot is busy, and `adopt` closes the
// second's socket with nothing sent. The first is served as before.
import { HttpServerLimits, HttpServerRequest } from "nish/net/http-server"
import { H2_FLAG_END_STREAM } from "nish/net/http2-frame"
import { netRead, netWrite } from "nish:net"
import { getOf, Wire } from "../net_http2/peer"
import { ZERO } from "../net_tls_record_common/bytes"
import { Preface } from "../net_http_server_h2c_preface/rig"

/** What `netRead` answers when nothing is waiting. */
const AGAIN: i32 = -11

export const main = (): i32 => {
  const p = new Preface(new HttpServerLimits(), true, toI32(1))
  const wire = new Wire()
  const none: i32[] = []
  const noValues: i64[] = []
  wire.preface()
  wire.settings(none, noValues)
  const opening: u8[] = wire.take()
  p.send(opening)
  p.read(9, 200)
  console.log(`first: SETTINGS back ${p.got.length >= 9 && toI32(p.got[3]) === 4}`)
  const second: i32 = p.dial()
  if (netWrite(second, opening, ZERO, toI32(opening.length)) !== toI32(opening.length)) {
    panic("short write")
  }
  const buf: u8[] = new Array<u8>(4096)
  let back: i32 = 0
  let ended: boolean = false
  for (let k: i32 = 0; k < 500 && !ended; k++) {
    p.turn(1)
    const n: i32 = netRead(second, buf, ZERO, toI32(buf.length))
    if (n > 0) {
      back += n
    } else if (n !== AGAIN) {
      ended = true
    }
  }
  console.log(`second: ${back} bytes back, ended ${ended}`)
  wire.headers(toI32(1), getOf("/first"), H2_FLAG_END_STREAM)
  p.send(wire.take())
  const req: HttpServerRequest = p.take()
  console.log(`first: version ${req.version}, /first ${req.pathIs("/first")}`)
  return 0
}
