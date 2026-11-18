// What one Http1Server connection holds in the arena, object by object, on
// the default `Http1Config`, read from `Arena.used()` around each allocation
// as tests/link/net_http1_server/startup.ts reads its total: an empty array
// and the fixed-size objects built alone, then a connection built as
// `Http1Server` builds a slot's, on a server's output, input and head pools
// and `Date`, counted after each of 4 keep-alive GETs and parks, and the
// lent and borrowed buffers' lengths while the first is served. Slot 0's
// connection serves the same GETs first, so what the pools keep is not
// counted against the second. Each object is stored into a slot made before
// its count starts, so it leaves main and is not put on the stack; every
// count is printed after the last, so no printed string lands in one. Prints
// `<name> <bytes>` lines; `chunk` in place of a count says the arena moved to
// a new chunk during it, which `Arena.used()` cannot see across.
//
//   build/nish bench/http1-conn/bytes.ts --link build/bench/http1-conn/bytes && build/bench/http1-conn/bytes
import { Http1Parser } from "nish/net/http1-codec"
import {
  H1_END,
  H1_NEED_MORE,
  Http1Config,
  Http1Connection,
  Http1Server,
  HttpDate,
} from "nish/net/http1-server"

const ascii = (text: string): u8[] => {
  const out: u8[] = []
  for (let i: i32 = 0; i < text.length; i += 1) {
    out.push(toU8(text.charCodeAt(i)))
  }
  return out
}

/** How many counts `main` takes. */
const COUNTS: i32 = 9
/** The buffer lengths kept: four while the first request is served, four once idle. */
const LENGTHS: i32 = 8

/** Bytes since `before`, or -1 when the arena moved to a new chunk since `mark`. */
const since = (mark: i64, before: i64): i64 => {
  const used: i64 = Arena.used() - before
  return Arena.mark() - mark === used ? used : toI64(-1)
}

/** The input, head, output and span buffers' lengths, into `lengths` from `at`. */
const keep = (conn: Http1Connection, lengths: i64[], at: i32): void => {
  lengths[at] = toI64(conn.parser.buf.length)
  lengths[at + 1] = toI64(conn.parser.head.length)
  lengths[at + 2] = toI64(conn.output.length)
  lengths[at + 3] = toI64(conn.parser.spans.length)
}

/** One request fed, answered and sent at once, as startup.ts serves it; keeps the held buffers' lengths at `at` when `at` is not negative. */
const serve = (
  conn: Http1Connection,
  req: u8[],
  names: u8[][],
  values: u8[][],
  body: u8[],
  lengths: i64[],
  at: i32
): boolean => {
  const len: i32 = toI32(req.length)
  if (conn.inputRoom() < len || conn.feed(req, 0, len) !== len) {
    return false
  }
  conn.headArrived(toI64(0))
  let answered: boolean = false
  let event: i32 = conn.next()
  while (event !== H1_NEED_MORE) {
    if (event === H1_END) {
      const n: i32 = toI32(body.length)
      if (conn.respond(200, names, values, n) !== 0 || conn.write(body, 0, n) !== n) {
        return false
      }
      conn.end()
      answered = true
    }
    event = conn.next()
  }
  if (at >= 0) {
    keep(conn, lengths, at)
  }
  conn.consume(conn.outputEnd - conn.outputStart)
  conn.release()
  conn.park()
  return answered && !conn.isDone() && conn.inputRoom() > 0 && !conn.wantsWrite()
}

export const main = (): i32 => {
  const config: Http1Config = new Http1Config()
  const counts: i64[] = new Array<i64>(COUNTS)
  const lengths: i64[] = new Array<i64>(LENGTHS)
  const arrays: u8[][] = [[]]
  const dates: HttpDate[] = [new HttpDate()]
  const parsers: Http1Parser[] = [
    new Http1Parser(config.maxTarget, config.maxHeaderBytes, config.maxHeaders, config.maxBody),
  ]
  const conns: Http1Connection[] = [
    new Http1Connection(config, dates[0]),
    new Http1Connection(config, dates[0]),
  ]
  let mark: i64 = Arena.mark()
  let before: i64 = Arena.used()
  arrays[0] = []
  counts[0] = since(mark, before)
  mark = Arena.mark()
  before = Arena.used()
  dates[0] = new HttpDate()
  counts[1] = since(mark, before)
  mark = Arena.mark()
  before = Arena.used()
  parsers[0] = new Http1Parser(config.maxTarget, config.maxHeaderBytes, config.maxHeaders, config.maxBody)
  counts[2] = since(mark, before)
  mark = Arena.mark()
  before = Arena.used()
  conns[0] = new Http1Connection(config, dates[0])
  counts[3] = since(mark, before)

  const server: Http1Server = new Http1Server(config, toI32(-1), toI32(16))
  server.date.pin(toI64(1700000000) * toI64(1000))
  const req: u8[] = ascii(
    "GET /api/v1/items/42 HTTP/1.1\r\n" +
      "Host: bench.example.com:8080\r\n" +
      "User-Agent: loadgen/1.0\r\n" +
      "Accept: application/json\r\n" +
      "Accept-Encoding: gzip, deflate\r\n" +
      "\r\n"
  )
  const names: u8[][] = [ascii("content-type")]
  const values: u8[][] = [ascii("application/json")]
  const body: u8[] = ascii('{"id":42,"name":"widget","price":1999,"tags":["a","b"],"ok":true}')
  const first: Http1Connection = server.connection(toI32(0))
  let served: boolean = true
  for (let i: i32 = 0; i < 4; i += 1) {
    served = served && serve(first, req, names, values, body, lengths, -1)
  }
  mark = Arena.mark()
  before = Arena.used()
  conns[1] = new Http1Connection(config, server.date)
  const conn: Http1Connection = conns[1]
  conn.pool = server.outputs
  conn.inputs = server.inputs
  conn.heads = server.heads
  counts[4] = since(mark, before)
  for (let i: i32 = 0; i < 4; i += 1) {
    served = served && serve(conn, req, names, values, body, lengths, i === 0 ? 0 : -1)
    counts[5 + i] = since(mark, before)
  }
  keep(conn, lengths, 4)

  const what: string[] = [
    "empty-array",
    "HttpDate",
    "Http1Parser-built",
    "Http1Connection-built",
    "pooled-built",
    "pooled-after-1",
    "pooled-after-2",
    "pooled-after-3",
    "pooled-after-4",
  ]
  for (let i: i32 = 0; i < COUNTS; i += 1) {
    console.log(`${what[i]} ${counts[i] < 0 ? "chunk" : `${counts[i]}`}`)
  }
  const held: string[] = ["input", "head", "output", "spans"]
  for (let i: i32 = 0; i < LENGTHS; i += 1) {
    console.log(`${i < 4 ? "serving" : "idle"}.${held[i % 4]} ${lengths[i]}`)
  }
  return served && arrays[0].length === 0 && parsers[0].resting() ? 0 : 1
}
