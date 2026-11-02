// What `net_handler_overlong`, `net_handler_short` and `net_handler_unbegun` share: a
// handler on loopback, a client that sends one GET and never reads, and the
// request the handler takes from it.
import { HandlerLimits, HttpHandler, HttpRequest } from "nish/net/handler"
import { Router, RouterLimits } from "nish/net/router"
import {
  connectResult,
  netAddress,
  netLocalPort,
  netWrite,
  pollAdd,
  pollCreate,
  pollWait,
  tcpConnect,
  tcpListen,
} from "nish:net"
import { ascii, ZERO } from "../net_tls_record_common/bytes"

/**
 * The length each response declares. Half of it is more than the carrier's
 * output and both socket buffers hold while the client reads nothing (the
 * sender's grows to 4 MiB at most), so some of it stays pending.
 */
export const DECLARED: i32 = 33554432

/** A handler and the one request it has taken. */
export class Taken {
  h: HttpHandler
  req: HttpRequest
  client: i32 = -1

  constructor() {
    const router = new Router(new RouterLimits())
    router.add("GET", "/")
    const listener: i32 = tcpListen("127.0.0.1", 0, 8)
    const h = new HttpHandler(new HandlerLimits(), listener, router)
    const addr: u8[] = new Array<u8>(18)
    netAddress(addr, "127.0.0.1", netLocalPort(listener))
    const client: i32 = tcpConnect(addr)
    const loop: i32 = pollCreate()
    const ready: i32[] = new Array<i32>(2)
    pollAdd(loop, client, 2, ZERO)
    if (pollWait(loop, ready, 5000) !== 1 || connectResult(client) !== 0) {
      panic("connect failed")
    }
    const request: u8[] = ascii("GET / HTTP/1.1\r\nHost: t\r\n\r\n")
    netWrite(client, request, ZERO, toI32(request.length))
    let turns: i32 = 0
    while (!h.ready() && turns < 5000) {
      h.wait(toI32(1))
      turns += 1
    }
    if (!h.ready()) {
      panic("no request")
    }
    this.h = h
    this.req = h.take()
    this.client = client
  }
}

/**
 * Starts the response with `DECLARED` bytes and writes half of them: the
 * carrier takes what its output holds and the handler keeps the rest pending.
 */
export const halfWritten = (t: Taken): void => {
  const names: u8[][] = [ascii("content-type")]
  const values: u8[][] = [ascii("application/octet-stream")]
  t.h.start(t.req, 200, names, values, DECLARED)
  const half: u8[] = new Array<u8>(DECLARED / 2)
  t.h.write(t.req, half, ZERO, toI32(half.length))
}
