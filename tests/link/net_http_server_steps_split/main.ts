// A step's field goes through the carrier's own checks, as the answer's own
// fields do: a value holding CR LF would end the head early and put a field of
// the step's choosing on the wire, so the answer panics before any byte of it
// is written. docs/security/http-server.md.
import { netAddress, netWrite, tcpConnect, tcpListen, netLocalPort } from "nish:net"
import { HttpServer, HttpServerLimits } from "nish/net/http-server"
import { Http1Config } from "nish/net/http1-server"
import { Router, RouterLimits } from "nish/net/router"
import { ascii } from "../net_tls_record_common/bytes"

export const main = (): i32 => {
  const router = new Router(new RouterLimits())
  router.add("GET", "/")
  const h = new HttpServer(new HttpServerLimits(), router)
  const listener: i32 = tcpListen("127.0.0.1", 0, 16)
  h.listenHttp1(listener, new Http1Config(), 1)
  const addr: u8[] = new Array<u8>(18)
  netAddress(addr, "127.0.0.1", netLocalPort(listener))
  const fd: i32 = tcpConnect(addr)
  const request: u8[] = ascii("GET / HTTP/1.1\r\nHost: localhost\r\n\r\n")
  let sent: i32 = 0
  for (let turn: i32 = 0; turn < 2000 && !h.ready(); turn++) {
    if (fd >= 0 && sent < toI32(request.length)) {
      const w: i32 = netWrite(fd, request, sent, toI32(request.length) - sent)
      if (w > 0) {
        sent = sent + w
      }
    }
    h.wait(5)
  }
  if (!h.ready()) {
    console.log("no request")
    return 0
  }
  const r = h.take()
  h.field(r, ascii("x-step"), ascii("1\r\nset-cookie: taken=1"))
  const body: u8[] = ascii("ok")
  h.send(r, 200, ascii("text/plain"), body, 0, toI32(body.length))
  console.log("unreachable")
  return 0
}
