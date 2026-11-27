// Part of the preface and then the peer's end, on a listener that takes h2c
// peers: the end decides the slot for HTTP/1.1, which reads the bytes and the
// end as a default port does, and closes the connection.
import { HttpServerLimits } from "nish/net/http-server"
import { netShutdown } from "nish:net"
import { Preface } from "../net_http_server_h2c_preface/rig"

const run = (p: Preface, label: string): void => {
  p.sendText("PRI * HTTP/2")
  p.read(1, 20)
  netShutdown(p.client, toI32(1))
  p.read(1000000, 300)
  console.log(`${label} ${p.got.length} bytes back, "${p.firstLine()}", ended ${p.ended}, taken ${p.h.ready()}`)
}

export const main = (): i32 => {
  run(new Preface(new HttpServerLimits(), true), "opted in:")
  run(new Preface(new HttpServerLimits(), false), "default: ")
  return 0
}
