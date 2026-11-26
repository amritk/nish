// 23 bytes of the preface, one write a byte, then a byte that differs. A
// listener that takes h2c peers sends nothing while each byte matches, and at
// the differing one HTTP/1.1 takes all 24 and answers `PRI * HTTP/2.0` with
// 505; the h2c carrier never sees them. A default port answers the same 505
// as soon as the head ends, at the preface's 18th byte.
import { HttpServerLimits } from "nish/net/http-server"
import { PREFACE } from "../net_http2/peer"
import { Preface } from "../net_http_server_h2c_preface/rig"

const run = (p: Preface, label: string): void => {
  const one: u8[] = new Array<u8>(1)
  for (let k: i32 = 0; k < 23; k++) {
    one[0] = toU8(PREFACE.charCodeAt(k))
    p.send(one)
    p.read(1, 3)
  }
  console.log(`${label} after 23 bytes: ${p.got.length} bytes back, ended ${p.ended}`)
  p.sendText("X")
  p.read(12, 300)
  console.log(`${label} ${p.firstLine()}, taken ${p.h.ready()}`)
}

export const main = (): i32 => {
  run(new Preface(new HttpServerLimits(), true), "opted in:")
  run(new Preface(new HttpServerLimits(), false), "default: ")
  return 0
}
