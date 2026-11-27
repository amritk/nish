// The http-lean-get record's component times, on one `Http1Connection` with
// every line in cache: the head parse apart from the header spans, and `Date`
// with its clock read. run.mjs builds this beside main.ts, against the same
// old and new `std/`, and times it in the same interleaved rounds (`--shape
// parts`); see bench/http1-conn/README.md.
//
//   parts parts <requests> 1 <batches>
//
// The parser's line scan and its field-line work are one inlined loop in
// `http1Section`, with no export between them, so they are told apart by what
// the shipped `next` is fed, not by a clock read inside it:
//
//   get         the `next` that answers `H1_REQUEST` on main.ts's GET: the
//               request line, Host and four more field lines, about 330 bytes
//   get-min     the same `next` on that GET with only its request line and
//               Host
//   trailers    the `next` that answers `H1_END` on a chunked POST whose
//               trailer section is the GET's four other field lines, byte for
//               byte: the trailer section runs the same line scan with no
//               head copy, and each line gets a name token check and a count,
//               with no lowering, OWS trim, framing kind or span
//   trailers-0  the same `next` on that POST with no trailer field
//
// `get` less `get-min` is the four lines kept as header fields; `trailers`
// less `trailers-0` is the same four lines scanned and counted; the second
// taken from the first is what keeping them costs, the header spans. Each
// span is cut by two `monotonicNanos` reads around the one call; `clock` is
// as many bare reads, back to back, for run.mjs to take out.
//
// `Date` is timed as `Http1Server` uses it, with `HttpDate` on the wall clock,
// not pinned: `hold` reads the clock at a readable event, the response's
// `current` answers that reading and rewrites the 29 bytes when the second
// has moved, and `unhold` follows at the flush. The loop around the three
// calls is this bench's own:
//
//   date-held     `hold`, `current` and `unhold` on a date on the wall clock
//   date-pinned   the same calls on a pinned date, which reads no clock
//   serve-dated   main.ts's hot request, the full GET read, answered and
//                 sent, between `hold` and `unhold` on a date on the wall
//                 clock: the clock read, the head rewritten once a second, and
//                 the kept head compared against a Date that moves
//   serve-pinned  the same requests on a pinned date
//
// The two serve shapes time the whole batch, and their `next` calls run with
// no clock read around them.
//
// Every shape runs `<batches>` times, the shapes taking turns, and keeps its
// fastest. Prints `parts <ns> <requests> <checksum>`, `<ns>` the fastest
// `get`, then a second line of `<shape> <ns>` pairs, each the fastest
// batch's total over `<requests>`. The checksum adds every response's length
// and status digit, every body byte count and first byte, and the Date
// bytes' tenth byte (a digit of the day of the month).

import { monotonicNanos } from "nish:process"
import {
  H1_BODY,
  H1_END,
  H1_NEED_MORE,
  H1_REQUEST,
  Http1Config,
  Http1Connection,
  Http1OutputPool,
  HttpDate,
} from "nish/net/http1-server"

/** The bytes of an ASCII string. */
const ascii = (text: string): u8[] => {
  const out: u8[] = []
  for (let i: i32 = 0; i < text.length; i += 1) {
    out.push(toU8(text.charCodeAt(i)))
  }
  return out
}

/** main.ts's 180-byte token in the shape of a JWT, the same bytes. */
const token = (): string => {
  const alphabet: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
  const parts: string[] = ["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."]
  let x: i32 = 7
  for (let n: i32 = 37; n < 180; n += 1) {
    x = (x * 1103 + 12345) & 65535
    parts.push(n === 140 ? "." : alphabet.substring(x & 63, (x & 63) + 1))
  }
  return parts.join("")
}

/** The GET's four field lines after Host, as main.ts's `request` sends them. */
const fieldLines = (): string =>
  "User-Agent: loadgen/1.0\r\n" +
  "Accept: application/json\r\n" +
  "Accept-Encoding: gzip, deflate\r\n" +
  `Authorization: Token ${token()}\r\n`

const GET_LINE: string = "GET /api/v1/items/42 HTTP/1.1\r\nHost: bench.example.com:8080\r\n"
const POST_HEAD: string =
  "POST /api/v1/orders HTTP/1.1\r\nHost: bench.example.com:8080\r\nTransfer-Encoding: chunked\r\n\r\n" +
  "5\r\nhello\r\n0\r\n"

/** The shapes, in the order each batch runs them and the second line prints them. */
const names = (): string[] => [
  "get",
  "get-min",
  "trailers",
  "trailers-0",
  "date-held",
  "date-pinned",
  "serve-dated",
  "serve-pinned",
]

/** One connection, as `Http1Server.build` makes a slot's, on its own date. */
class One {
  conn: Http1Connection
  date: HttpDate
  body: u8[]
  names: u8[][]
  values: u8[][]
  now: i64 = 0
  sum: i64 = 0

  constructor(pinned: boolean) {
    const config: Http1Config = new Http1Config()
    this.date = new HttpDate()
    if (pinned) {
      this.date.pin(toI64(1700000000) * toI64(1000))
    }
    this.conn = new Http1Connection(config, this.date)
    this.conn.pool = new Http1OutputPool(config.outputSize)
    this.body = ascii('{"id":42,"name":"widget","price":1999,"tags":["a","b"],"ok":true}')
    this.names = [ascii("content-type")]
    this.values = [ascii("application/json")]
  }

  /**
   * One request read, answered and sent, as main.ts's `Bench.serve`; answers
   * the ns of the one `next` that returns `timed`, between two clock reads.
   * With `timed` negative it reads no clock and answers 0, so a loop that
   * times whole requests pays for none of these reads.
   */
  serve(req: u8[], timed: i32): i64 {
    const conn: Http1Connection = this.conn
    const len: i32 = toI32(req.length)
    if (conn.inputRoom() < len || conn.feed(req, 0, len) !== len) {
      panic("bench: the connection took less than a request")
    }
    this.now = this.now + toI64(1000)
    conn.lastActive = this.now
    conn.headArrived(this.now)
    let span: i64 = 0
    let event: i32 = H1_NEED_MORE
    let more: boolean = true
    while (more) {
      if (timed < 0) {
        event = conn.next()
      } else {
        const before: i64 = monotonicNanos()
        event = conn.next()
        const after: i64 = monotonicNanos()
        if (event === timed) {
          span = after - before
        }
      }
      if (event === H1_NEED_MORE) {
        more = false
      } else if (event === H1_REQUEST) {
        // Nothing to read until the end of the request.
      } else if (event === H1_BODY) {
        this.sum = this.sum + toI64(conn.dataLength) + toI64(conn.data[conn.dataStart])
      } else if (event === H1_END) {
        const n: i32 = toI32(this.body.length)
        if (conn.respond(200, this.names, this.values, n) !== 0 || conn.write(this.body, 0, n) !== n) {
          panic("bench: the response was refused")
        }
        conn.end()
      } else {
        panic(`bench: unexpected event ${event}`)
      }
    }
    const pending: i32 = conn.outputEnd - conn.outputStart
    this.sum = this.sum + toI64(pending) + toI64(conn.output[conn.outputStart + 9])
    conn.consume(pending)
    conn.release()
    if (conn.isDone()) {
      panic("bench: the connection closed")
    }
    conn.park()
    return span
  }

  /** `requests` requests, the spans of the `next` that returns `timed` summed. */
  spans(req: u8[], timed: i32, requests: i32): i64 {
    let total: i64 = 0
    for (let k: i32 = 0; k < requests; k += 1) {
      total = total + this.serve(req, timed)
    }
    return total
  }

  /** `requests` requests, each between `hold` and `unhold` as a serve call holds the date: the batch's ns. */
  held(req: u8[], requests: i32): i64 {
    const started: i64 = monotonicNanos()
    for (let k: i32 = 0; k < requests; k += 1) {
      this.date.hold()
      this.serve(req, -1)
      this.date.unhold()
    }
    return monotonicNanos() - started
  }
}

/** `requests` rounds of `hold`, `current` and `unhold` on `date`: the batch's ns; adds a Date byte a round to `sums[0]`. */
const dateRounds = (date: HttpDate, requests: i32, sums: i64[]): i64 => {
  let sum: i64 = 0
  const started: i64 = monotonicNanos()
  for (let k: i32 = 0; k < requests; k += 1) {
    date.hold()
    const bytes: u8[] = date.current()
    sum = sum + toI64(bytes[9])
    date.unhold()
  }
  const ns: i64 = monotonicNanos() - started
  sums[0] = sums[0] + sum
  return ns
}

export const main = (): i32 => {
  const requests: i32 = process.argv.length > 2 ? parseInt(process.argv[2]) : 200000
  const batches: i32 = process.argv.length > 4 ? parseInt(process.argv[4]) : 5
  const get: u8[] = ascii(GET_LINE + fieldLines() + "\r\n")
  const getMin: u8[] = ascii(GET_LINE + "\r\n")
  const trailers: u8[] = ascii(POST_HEAD + fieldLines() + "\r\n")
  const trailers0: u8[] = ascii(POST_HEAD + "\r\n")
  const pinned: One = new One(true)
  const dated: One = new One(false)
  const wall: HttpDate = new HttpDate()
  const fixed: HttpDate = new HttpDate()
  fixed.pin(toI64(1700000000) * toI64(1000))
  // One untimed request of each kind: the buffers made and the kept head
  // written, as on a server past its warm-up.
  pinned.serve(get, H1_REQUEST)
  pinned.serve(trailers, H1_END)
  dated.serve(get, H1_REQUEST)
  // Only the Date bytes enter the checksum from the dated shapes: the clock
  // decides when its head is rewritten, which no two runs share.
  const dateSums: i64[] = [0]
  const best: i64[] = [0, 0, 0, 0, 0, 0, 0, 0]
  for (let batch: i32 = 0; batch < batches; batch += 1) {
    const got: i64[] = [
      pinned.spans(get, H1_REQUEST, requests),
      pinned.spans(getMin, H1_REQUEST, requests),
      pinned.spans(trailers, H1_END, requests),
      pinned.spans(trailers0, H1_END, requests),
      dateRounds(wall, requests, dateSums),
      dateRounds(fixed, requests, dateSums),
      dated.held(get, requests),
      pinned.held(get, requests),
    ]
    for (let s: i32 = 0; s < 8; s += 1) {
      if (batch === 0 || got[s] < best[s]) {
        best[s] = got[s]
      }
    }
  }
  // The clock alone: as many reads as a shape makes spans, back to back.
  let clock: i64 = 0
  for (let batch: i32 = 0; batch < batches; batch += 1) {
    const started: i64 = monotonicNanos()
    let last: i64 = started
    for (let k: i32 = 0; k < requests; k += 1) {
      last = monotonicNanos()
    }
    const c: i64 = last - started
    if (batch === 0 || c < clock) {
      clock = c
    }
  }
  // The wall date's bytes name today, which differs between runs: only the
  // pinned rounds and the pinned connection's answers are summed.
  const sum: i64 = pinned.sum + (dateSums[0] > 0 ? toI64(1) : toI64(0))
  console.log(`parts ${best[0]} ${requests} ${sum}`)
  const cells: string[] = [`clock ${clock}`]
  const shapes: string[] = names()
  for (let s: i32 = 0; s < 8; s += 1) {
    cells.push(`${shapes[s]} ${best[s]}`)
  }
  console.log(cells.join(" "))
  return 0
}
