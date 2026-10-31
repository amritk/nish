// `Http1Server.accept` reads each connection's MSS from its socket: over
// loopback a served connection's `socketMss` is positive and is `netMss` of
// the same descriptor, and `respondEncoded` counts segments in it, so a
// 3000-byte body that four 1448-byte segments would gzip goes as it is in one
// loopback segment. Then the order `segmentMss` documents: an `mss` the
// program sets on the connection wins over everything, an `enc.mss` it sets
// wins over the socket's, and a slot accepted into again starts from the new
// socket's value, not the last connection's own or the program's.
import { HTTP_COMPRESS_NO_FEWER_SEGMENTS, HTTP_COMPRESS_SENT, HTTP_DEFAULT_MSS, HttpCompressor } from "nish/net/http-compress"
import { DEFLATE_FAST } from "nish/compress/deflate"
import { H1_AGAIN, H1_REQUEST, Http1Config, Http1Connection, Http1Server } from "nish/net/http1-server"
import { netAddress, netClose, netLocalPort, netMss, netWrite, pollAdd, pollCreate, pollWait, tcpConnect, tcpListen } from "nish:net"
import { Suite } from "nish/testing"

/** The bytes of an ASCII string. */
const ascii = (text: string): u8[] => {
  const out: u8[] = new Array<u8>(text.length)
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    out[i] = toU8(text.charCodeAt(i))
  }
  return out
}

/** `count` bytes of JSON-shaped text, which gzip shrinks well. */
const json = (count: i32): u8[] => {
  const parts: string[] = []
  let length: i32 = 0
  let i: i32 = 0
  while (length < count) {
    const item: string = `{"id":${i},"name":"item ${i}","ok":true},`
    parts.push(item)
    length += toI32(item.length)
    i++
  }
  const out: u8[] = ascii(parts.join(""))
  const body: u8[] = new Array<u8>(count)
  for (let k: i32 = 0; k < count; k++) {
    body[k] = out[k]
  }
  return body
}

/** Whether the connection's queued output names `Content-Encoding: gzip`. */
const gzipped = (conn: Http1Connection): boolean => {
  const parts: string[] = []
  for (let i: i32 = conn.outputStart; i < conn.outputEnd; i++) {
    const c: i32 = toI32(conn.output[i])
    parts.push(String.fromCharCode(c >= 65 && c <= 90 ? c + 32 : c))
  }
  return parts.join("").indexOf("content-encoding: gzip") >= 0
}

/** `server.accept`, waiting on `loop` up to a second for the connection to arrive. */
const acceptWaiting = (server: Http1Server, loop: i32, ready: i32[]): i32 => {
  let slot: i32 = server.accept()
  for (let k: i32 = 0; k < 10 && slot === H1_AGAIN; k++) {
    pollWait(loop, ready, toI32(100))
    slot = server.accept()
  }
  return slot
}

/** Reads `slot` until its next event is not `H1_NEED_MORE`'s wait, up to a second, and answers that event. */
const nextEvent = (server: Http1Server, slot: i32): i32 => {
  const loop: i32 = pollCreate()
  pollAdd(loop, server.fd(slot), toI32(1), toI32(0))
  const ready: i32[] = new Array<i32>(2)
  let event: i32 = server.next(slot)
  for (let k: i32 = 0; k < 10 && event !== H1_REQUEST; k++) {
    pollWait(loop, ready, toI32(100))
    server.readable(slot)
    event = server.next(slot)
  }
  netClose(loop)
  return event
}

export const main = (): i32 => {
  const t = new Suite("std_http1_mss")
  const listener: i32 = tcpListen("127.0.0.1", toI32(0), toI32(4))
  const addr: u8[] = new Array<u8>(18)
  netAddress(addr, "127.0.0.1", netLocalPort(listener))
  const loop: i32 = pollCreate()
  pollAdd(loop, listener, toI32(1), toI32(0))
  const ready: i32[] = new Array<i32>(4)
  const server = new Http1Server(new Http1Config(), listener, toI32(1))
  const enc = new HttpCompressor(DEFLATE_FAST, 256, 65536)
  enc.segmentMode = true
  const body: u8[] = json(3000)
  const none: u8[][] = []
  const request: u8[] = ascii("GET / HTTP/1.1\r\nhost: x\r\naccept-encoding: gzip\r\n\r\n")

  // The socket's MSS, read at accept.
  const first: i32 = tcpConnect(addr)
  const slot: i32 = acceptWaiting(server, loop, ready)
  t.eqI32("accept: slot 0", slot, 0)
  const conn: Http1Connection = server.connection(slot)
  const socket: i32 = netMss(server.fd(slot))
  t.ok("accept: loopback reports an MSS that holds a 3000-byte response and its head", socket > 3200)
  t.eqI32("accept: socketMss is netMss of the slot's descriptor", conn.socketMss, socket)
  t.eqI32("accept: the program's mss is left at 0", conn.mss, 0)
  t.eqI32("order: an enc.mss left at HTTP_DEFAULT_MSS takes the socket's", conn.segmentMss(enc), socket)

  // respondEncoded counts in it: 3000 bytes fit one loopback segment as they are.
  netWrite(first, request, toI32(0), toI32(request.length))
  t.eqI32("socket: the request", nextEvent(server, slot), H1_REQUEST)
  t.eqI32("socket: respondEncoded", conn.respondEncoded(200, none, none, body, 0, 3000, enc, conn.acceptEncoding()), 0)
  t.ok("socket: one segment at the socket's MSS, so not gzipped", !gzipped(conn) && enc.decision === HTTP_COMPRESS_NO_FEWER_SEGMENTS)

  // An enc.mss the program sets wins over the socket's; a conn.mss it sets wins over both.
  enc.mss = 1000
  t.eqI32("order: a set enc.mss wins over the socket's", conn.segmentMss(enc), 1000)
  conn.mss = 600
  t.eqI32("order: a set conn.mss wins over enc.mss", conn.segmentMss(enc), 600)
  enc.mss = HTTP_DEFAULT_MSS
  t.eqI32("order: and over the socket's", conn.segmentMss(enc), 600)
  conn.mss = 0

  // On the same kept-alive connection the socket's value holds; a set enc.mss
  // makes the same response take three segments plain and one gzipped.
  netWrite(first, request, toI32(0), toI32(request.length))
  server.flush(slot)
  enc.mss = 1000
  t.eqI32("kept alive: the next request", nextEvent(server, slot), H1_REQUEST)
  t.eqI32("kept alive: socketMss is not read again or lost", conn.socketMss, socket)
  t.eqI32("kept alive: respondEncoded", conn.respondEncoded(200, none, none, body, 0, 3000, enc, conn.acceptEncoding()), 0)
  t.ok("kept alive: at the set enc.mss, gzipped", gzipped(conn) && enc.decision === HTTP_COMPRESS_SENT)
  enc.mss = HTTP_DEFAULT_MSS

  // A slot accepted into again: what the last connection held is gone.
  conn.mss = 600
  conn.socketMss = 7
  server.close(slot)
  netClose(first)
  const second: i32 = tcpConnect(addr)
  const again: i32 = acceptWaiting(server, loop, ready)
  t.ok("reuse: the slot is taken again, its connection kept", again === 0 && server.connection(again) === conn)
  t.eqI32("reuse: socketMss is the new socket's", conn.socketMss, netMss(server.fd(again)))
  t.eqI32("reuse: the program's mss is back to 0", conn.mss, 0)
  server.close(again)
  netClose(second)

  // A connection no socket accepted: nothing read, so the default.
  const bare = new Http1Connection(new Http1Config())
  t.eqI32("bare: socketMss 0", bare.socketMss, 0)
  t.eqI32("bare: HTTP_DEFAULT_MSS", bare.segmentMss(enc), HTTP_DEFAULT_MSS)

  netClose(loop)
  netClose(listener)
  return t.done()
}
