// An h2c peer on a default HTTP/1.1 listener: nothing reads ahead, and the
// preface is an HTTP/1.1 request line that HTTP/1.1 refuses, as before.
import { HttpServerLimits } from "nish/net/http-server"
import { Wire } from "../net_http2/peer"
import { Preface } from "../net_http_server_h2c_preface/rig"

export const main = (): i32 => {
  const p = new Preface(new HttpServerLimits(), false)
  const wire = new Wire()
  const none: i32[] = []
  const noValues: i64[] = []
  wire.preface()
  wire.settings(none, noValues)
  p.send(wire.take())
  p.read(12, 200)
  console.log(p.firstLine())
  console.log(`taken: ${p.h.ready()}`)
  return 0
}
