// An HTTP/1.1 peer on a listener that takes h2c peers: its first byte differs
// from the preface, so the connection is HTTP/1.1's, with that byte read.
import { HttpServerLimits, HttpServerRequest } from "nish/net/http-server"
import { ascii, ZERO } from "../net_tls_record_common/bytes"
import { Preface } from "../net_http_server_h2c_preface/rig"

export const main = (): i32 => {
  const p = new Preface(new HttpServerLimits(), true)
  p.sendText("GET /users/7 HTTP/1.1\r\nHost: t\r\n\r\n")
  const req: HttpServerRequest = p.take()
  console.log(`version ${req.version}, GET ${req.methodIs("GET")}, /users/7 ${req.pathIs("/users/7")}`)
  const body: u8[] = ascii("hi\n")
  p.h.send(req, 200, ascii("text/plain"), body, ZERO, toI32(body.length))
  p.read(12, 200)
  console.log(p.firstLine())
  return 0
}
