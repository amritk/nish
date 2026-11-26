// Part of the preface and then silence, on a listener that takes h2c peers:
// the slot is closed `prefaceTimeout` after accept, long before `idleTimeout`.
import { HttpServerLimits } from "nish/net/http-server"
import { Preface } from "../net_http_server_h2c_preface/rig"

export const main = (): i32 => {
  const limits = new HttpServerLimits()
  limits.prefaceTimeout = 200
  limits.idleTimeout = 60000
  const p = new Preface(limits, true)
  p.sendText("PRI * HTTP/2")
  p.read(1, 50)
  console.log(`before: ${p.got.length} bytes, ended ${p.ended}`)
  p.read(1, 3000)
  console.log(`after: ${p.got.length} bytes, ended ${p.ended}`)
  return 0
}
