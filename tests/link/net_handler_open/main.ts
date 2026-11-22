// `openHttpHandler` answers limits it cannot use with an `Err`, never a panic,
// and a handler it opens serves a request answered through the `try*` twins.
import { HandlerLimits, HttpHandler, openHttpHandler } from "nish/net/handler"
import { Router, RouterLimits } from "nish/net/router"
import {
  connectResult,
  netAddress,
  netClose,
  netLocalPort,
  netRead,
  netWrite,
  pollAdd,
  pollCreate,
  pollWait,
  tcpConnect,
  tcpListen,
} from "nish:net"
import { ascii, ZERO } from "../net_tls_record_common/bytes"

export const main = (): i32 => {
  const router = new Router(new RouterLimits())
  router.add("GET", "/")
  const listener: i32 = tcpListen("127.0.0.1", 0, 8)

  const bad = new HandlerLimits()
  bad.slots = 0
  const refused: Result<HttpHandler, string> = openHttpHandler(bad, listener, router)
  if (refused.isErr()) {
    console.log(`limits: ${refused.error}`)
  } else {
    console.log("FAIL  openHttpHandler took slots 0")
  }

  const opened: Result<HttpHandler, string> = openHttpHandler(new HandlerLimits(), listener, router)
  if (opened.isErr()) {
    console.log(`FAIL  ${opened.error}`)
    return 1
  }
  const h: HttpHandler = opened.value
  const addr: u8[] = new Array<u8>(18)
  netAddress(addr, "127.0.0.1", netLocalPort(listener))
  const client: i32 = tcpConnect(addr)
  const loop: i32 = pollCreate()
  const ready: i32[] = new Array<i32>(2)
  pollAdd(loop, client, 2, ZERO)
  if (pollWait(loop, ready, 5000) !== 1 || connectResult(client) !== 0) {
    console.log("FAIL  connect")
    return 1
  }
  const request: u8[] = ascii("GET / HTTP/1.1\r\nHost: t\r\nConnection: close\r\n\r\n")
  netWrite(client, request, ZERO, toI32(request.length))
  let req = h.next()
  let turns: i32 = 0
  while (req === null && turns < 5000) {
    h.wait(toI32(1))
    req = h.next()
    turns += 1
  }
  if (req === null) {
    console.log("FAIL  no request")
    return 1
  }
  const w = h.json()
  w.beginObject()
  w.key("ok")
  w.boolean(true)
  w.endObject()
  const sent: Result<i32, string> = h.trySendJson(req, 200)
  console.log(sent.isErr() ? `FAIL  ${sent.error}` : `sent: ${sent.value}`)

  // Turn the handler until the client has the whole answer.
  const got: u8[] = new Array<u8>(4096)
  let length: i32 = 0
  let reads: i32 = 0
  while (reads < 5000) {
    h.wait(toI32(1))
    const n: i32 = netRead(client, got, length, toI32(got.length) - length)
    if (n === 0) {
      break
    }
    if (n > 0) {
      length += n
    }
    reads += 1
  }
  const text: string = String.fromBytes(got, ZERO, length)
  console.log(text.startsWith("HTTP/1.1 200") ? "status: 200" : `FAIL  ${text}`)
  console.log(text.endsWith('{"ok":true}') ? 'body: {"ok":true}' : `FAIL  ${text}`)
  netClose(client)
  return 0
}
