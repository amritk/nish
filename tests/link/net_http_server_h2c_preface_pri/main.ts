// A request whose method is `PRI` on a listener that takes h2c peers: it
// matches the preface for 9 bytes and then differs, so HTTP/1.1 takes the
// connection with those bytes and serves it as a listener that did not opt
// in does. Both servers hand the program the same request, and both send its
// answer.
import { HttpServerLimits, HttpServerRequest } from "nish/net/http-server"
import { ascii, ZERO } from "../net_tls_record_common/bytes"
import { Preface } from "../net_http_server_h2c_preface/rig"

const serve = (p: Preface, label: string): void => {
  p.sendText("PRI * HTTP/1.1\r\nHost: t\r\n\r\n")
  const req: HttpServerRequest = p.take()
  console.log(`${label} version ${req.version}, PRI ${req.methodIs("PRI")}, * ${req.pathIs("*")}`)
  const body: u8[] = ascii("hi\n")
  p.h.send(req, 200, ascii("text/plain"), body, ZERO, toI32(body.length))
  p.read(12, 200)
  console.log(`${label} ${p.firstLine()}`)
}

export const main = (): i32 => {
  serve(new Preface(new HttpServerLimits(), true), "opted in:")
  serve(new Preface(new HttpServerLimits(), false), "default: ")
  return 0
}
