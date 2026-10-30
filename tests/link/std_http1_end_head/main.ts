// A request's head at its end: on a kept-alive connection with the next
// request already fed behind it, `HTTP1_END` / `H1_END` still read the request
// that ended (method, target, version, fields), so a response written there
// answers it and not the pipelined one. `acceptEncoding` and `targetIs` read
// the first request's at its `H1_END`; a HEAD answered there gets no body and
// an HTTP/1.0 client is not sent chunked; the next request reads whole after.
import { HTTP1_CHUNKED, HTTP1_END, HTTP1_HEAD, Http1Parser } from "nish/net/http1"
import { HTTP_CODING_GZIP, HTTP_CODING_IDENTITY, HttpCompressor } from "nish/net/http-compress"
import { DEFLATE_FAST } from "nish/compress/deflate"
import { H1_END, H1_REQUEST, Http1Config, Http1Connection } from "nish/net/http1-server"
import { Suite } from "nish/testing"

/** The bytes of an ASCII string. */
const ascii = (text: string): u8[] => {
  const out: u8[] = new Array<u8>(text.length)
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    out[i] = toU8(text.charCodeAt(i))
  }
  return out
}

/** The connection's queued output from `from`, as text, ASCII upper case lowered. */
const output = (conn: Http1Connection, from: i32): string => {
  const parts: string[] = []
  for (let i: i32 = from; i < conn.outputEnd; i++) {
    const c: i32 = toI32(conn.output[i])
    parts.push(String.fromCharCode(c >= 65 && c <= 90 ? c + 32 : c))
  }
  return parts.join("")
}

/** A connection fed `bytes`, read through the first request's `H1_END`. */
const atEnd = (t: Suite, label: string, bytes: string): Http1Connection => {
  const conn = new Http1Connection(new Http1Config())
  const b: u8[] = ascii(bytes)
  conn.feed(b, 0, toI32(b.length))
  t.eqI32(`${label}: the first request`, conn.next(), H1_REQUEST)
  t.eqI32(`${label}: its end`, conn.next(), H1_END)
  return conn
}

export const main = (): number => {
  const t = new Suite("http1-end-head")
  const names: u8[][] = [ascii("content-type")]
  const values: u8[][] = [ascii("text/plain")]

  // --- The parser ---------------------------------------------------------------
  {
    const p = new Http1Parser(256, 4096, 32, 4096)
    const b: u8[] = ascii("GET /first HTTP/1.1\r\nhost: a\r\nx-first: 1\r\n\r\nPUT /second HTTP/1.0\r\nhost: b\r\ncontent-length: 0\r\n\r\n")
    p.feed(b, 0, toI32(b.length))
    t.eqI32("parser: the head", p.next(), HTTP1_HEAD)
    t.eqI32("parser: the end", p.next(), HTTP1_END)
    t.ok("parser: at the end, the method and target are the first's", p.methodIs("GET") && p.targetIs("/first") && p.method === "GET" && p.target === "/first")
    t.ok("parser: and its fields", p.headerIs("x-first", "1") && p.headerIs("host", "a") && p.headerCount === 2)
    t.ok("parser: and its version and keep-alive", p.minor === 1 && p.keepAlive)
    t.ok("parser: the head held is not resting", !p.resting())
    t.eqI32("parser: the next head", p.next(), HTTP1_HEAD)
    t.ok("parser: is the second's, whole", p.methodIs("PUT") && p.targetIs("/second") && p.minor === 0 && p.headerIndex("x-first") < 0 && p.headerIs("host", "b"))
    t.eqI32("parser: and its end", p.next(), HTTP1_END)
    t.ok("parser: HTTP/1.0 without keep-alive closes, its head still read", p.methodIs("PUT") && p.minor === 0)
  }

  // --- acceptEncoding and targetIs at H1_END -------------------------------------
  {
    const conn = atEnd(
      t,
      "pipelined",
      "GET /first HTTP/1.1\r\nhost: a\r\naccept-encoding: gzip\r\n\r\nGET /second HTTP/1.1\r\nhost: a\r\n\r\n"
    )
    t.eqI32("pipelined: acceptEncoding at H1_END is the first's gzip", conn.acceptEncoding(), HTTP_CODING_GZIP)
    t.ok("pipelined: targetIs at H1_END is the first's", conn.parser.targetIs("/first") && !conn.parser.targetIs("/second"))
    const enc = new HttpCompressor(DEFLATE_FAST, 256, 65536)
    const body: u8[] = ascii("hello")
    t.eqI32("pipelined: answered at H1_END", conn.respondEncoded(200, names, values, body, 0, 5, enc, conn.acceptEncoding()), 0)
    const first: i32 = conn.outputEnd
    t.eqI32("pipelined: the second request", conn.next(), H1_REQUEST)
    t.ok("pipelined: reads as the second", conn.parser.targetIs("/second"))
    t.eqI32("pipelined: without gzip", conn.acceptEncoding(), HTTP_CODING_IDENTITY)
    t.eqI32("pipelined: its end", conn.next(), H1_END)
    t.eqI32("pipelined: still the second's at its end", conn.acceptEncoding(), HTTP_CODING_IDENTITY)
    t.ok("pipelined: the first response is whole", output(conn, conn.outputStart).startsWith("http/1.1 200 ok\r\n") && first > conn.outputStart)
  }

  // --- A response written at H1_END reads its own request ------------------------
  {
    const head = atEnd(t, "HEAD", "HEAD /h HTTP/1.1\r\nhost: a\r\n\r\nGET /next HTTP/1.1\r\nhost: a\r\n\r\n")
    t.eqI32("HEAD: respond at H1_END", head.respond(200, names, values, 5), 0)
    t.ok("HEAD: no body is owed", head.responseEmpty)
    t.eqI32("HEAD: the body is taken and not sent", head.write(ascii("hello"), 0, 5), 5)
    t.ok("HEAD: the output is the head alone", output(head, head.outputStart).endsWith("content-length: 5\r\n\r\n"))

    const old = atEnd(t, "HTTP/1.0", "GET /old HTTP/1.0\r\nhost: a\r\nconnection: keep-alive\r\n\r\nGET /next HTTP/1.0\r\nhost: a\r\n\r\n")
    t.eqI32("HTTP/1.0: respond chunked at H1_END", old.respond(200, names, values, HTTP1_CHUNKED), 0)
    const o: string = output(old, old.outputStart)
    t.ok("HTTP/1.0: not chunked", o.indexOf("transfer-encoding") < 0)
    t.ok("HTTP/1.0: read to the close", o.indexOf("connection: close\r\n") >= 0 && old.closeAfter)
  }
  return t.done()
}
