// `respondEncoded` with a window outside its body: a negative offset or
// length, or one past the end, is `H1_INVALID`, not a panic, and nothing is
// queued; the same connection then answers a window inside the body.
import { HttpCompressor } from "nish/net/http-compress"
import { DEFLATE_FAST } from "nish/compress/deflate"
import { H1_END, H1_INVALID, H1_REQUEST, Http1Config, Http1Connection } from "nish/net/http1-server"
import { Suite } from "nish/testing"

/** The bytes of an ASCII string. */
const ascii = (text: string): u8[] => {
  const out: u8[] = new Array<u8>(text.length)
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    out[i] = toU8(text.charCodeAt(i))
  }
  return out
}

export const main = (): number => {
  const t = new Suite("http1-encoded-window")
  const names: u8[][] = [ascii("content-type")]
  const values: u8[][] = [ascii("text/plain")]
  const conn = new Http1Connection(new Http1Config())
  const req: u8[] = ascii("GET / HTTP/1.1\r\nhost: a\r\n\r\n")
  conn.feed(req, 0, toI32(req.length))
  t.eqI32("the request", conn.next(), H1_REQUEST)
  t.eqI32("its end", conn.next(), H1_END)
  const enc = new HttpCompressor(DEFLATE_FAST, 256, 65536)
  const body: u8[] = ascii("hello, world")
  const coding: i32 = conn.acceptEncoding()
  const before: i32 = conn.outputEnd
  t.eqI32("a negative offset is H1_INVALID", conn.respondEncoded(200, names, values, body, -1, 4, enc, coding), H1_INVALID)
  t.eqI32("a negative length is H1_INVALID", conn.respondEncoded(200, names, values, body, 0, -4, enc, coding), H1_INVALID)
  t.eqI32("a window past the end is H1_INVALID", conn.respondEncoded(200, names, values, body, 8, 5, enc, coding), H1_INVALID)
  t.eqI32("a window past i32 is H1_INVALID", conn.respondEncoded(200, names, values, body, 2147483647, 1, enc, coding), H1_INVALID)
  t.eqI32("nothing was queued", conn.outputEnd, before)
  t.eqI32("a window inside the body is answered", conn.respondEncoded(200, names, values, body, 7, 5, enc, coding), 0)
  t.ok("and queued", conn.outputEnd > before)
  return t.done()
}
