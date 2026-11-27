// Part of the preface and then a drain, on a listener that takes h2c peers:
// the slot holds no request, so the drain closes it as it closes an idle
// HTTP/1.1 connection, with nothing sent.
import { HttpServerLimits } from "nish/net/http-server"
import { Preface } from "../net_http_server_h2c_preface/rig"

export const main = (): i32 => {
  const p = new Preface(new HttpServerLimits(), true)
  p.sendText("PRI * HTTP/2")
  p.read(1, 20)
  console.log(`before: ${p.got.length} bytes back, ended ${p.ended}`)
  p.h.drain()
  p.read(1, 300)
  console.log(`after drain: ${p.got.length} bytes back, ended ${p.ended}`)
  return 0
}
