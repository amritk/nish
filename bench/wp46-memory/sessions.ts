// WP46's baseline: an HTTP/1.1 server whose long-lived state has no size known
// at start-up. One keep-alive `Http1Connection` is fed `GET /s/<id>` requests
// in memory; the handler keeps a session per client id in a `Map`, each with
// a payload of 16 to 255 bytes, and evicts the oldest once `live` are held, so
// the live set is bounded. Every `every` requests it prints the arena's bump
// position and offset (`Arena.mark`, `Arena.used`) and the anonymous resident
// set from /proc/<pid>/statm. Today every session's memory is in the
// process's arena, and an evicted one is never given back: the figures grow
// with the sessions ever made, not with the live set.
//
//   build/nish bench/wp46-memory/sessions.ts --link build/wp46/sessions
//   build/wp46/sessions <requests> <live> <every>
import { readFileSyncOrNull } from "nish:fs"
import { spawnSyncTo } from "nish:process"
import { H1_END, H1_NEED_MORE, H1_REQUEST, Http1Config, Http1Connection } from "nish/net/http1-server"

class Session {
  id: i64
  hits: i64 = 0
  payload: u8[]
  constructor(id: i64, size: i32) {
    this.id = id
    this.payload = new Array<u8>(size)
    for (let k: i32 = 0; k < size; k++) {
      this.payload[k] = toU8((id + toI64(k)) & 255)
    }
  }
}

class Cache {
  sessions: Map<i64, Session>
  /** Insertion order of the held ids, a ring of `live`: the oldest is evicted first. */
  order: i64[]
  head: i32 = 0
  held: i32 = 0
  made: i64 = 0
  constructor(live: i32) {
    this.sessions = new Map<i64, Session>()
    this.order = new Array<i64>(live)
  }

  touch(id: i64): Session {
    const found: Session | undefined = this.sessions.get(id)
    if (found !== undefined) {
      found.hits = found.hits + 1
      return found
    }
    const live: i32 = toI32(this.order.length)
    if (this.held === live) {
      this.sessions.delete(this.order[this.head])
      this.held = this.held - 1
    }
    const s: Session = new Session(id, 16 + toI32(((id * 2654435761) >> 7) & 239))
    this.sessions.set(id, s)
    this.order[this.head] = id
    this.head = (this.head + 1) % live
    this.held = this.held + 1
    this.made = this.made + 1
    return s
  }
}

const anonBytes = (argv: string[], scratch: string, pages: i64[]): i64 => {
  if (spawnSyncTo(argv, scratch, "") !== 0) {
    return -1
  }
  const text: string | null = readFileSyncOrNull(scratch)
  if (text === null) {
    return -1
  }
  let field: i32 = 0
  let value: i64 = 0
  let digits: boolean = false
  for (let k: i32 = 0; k < toI32(text.length) && field < 3; k++) {
    const c: i32 = text.charCodeAt(k)
    if (c >= 48 && c <= 57) {
      value = value * 10 + toI64(c - 48)
      digits = true
    } else if (digits) {
      pages[field] = value
      field = field + 1
      value = 0
      digits = false
    }
  }
  return (pages[1] - pages[2]) * 4096
}

export const main = (): i32 => {
  const requests: i64 = process.argv.length > 1 ? toI64(Number(process.argv[1])) : 1000000
  const live: i32 = process.argv.length > 2 ? toI32(Number(process.argv[2])) : 1000
  const every: i64 = process.argv.length > 3 ? toI64(Number(process.argv[3])) : 100000
  const argv: string[] = ["sh", "-c", "cat /proc/$PPID/statm"]
  const scratch: string = "/tmp/wp46-sessions.statm"
  const pages: i64[] = [0, 0, 0]
  const cache: Cache = new Cache(live)
  const conn: Http1Connection = new Http1Connection(new Http1Config())
  const request: u8[] = new Array<u8>(64)
  const noNames: u8[][] = []
  let checksum: i64 = 0
  let x: i64 = 2463534242
  for (let r: i64 = 0; r < requests; r++) {
    // xorshift: a client id from a population ten times the live set, so the cache churns
    x = x ^ (x << 13)
    x = x ^ (x >> 7)
    x = x ^ (x << 17)
    const id: i64 = ((x >> 1) & 0x7fffffff) % (toI64(live) * 10)
    let n: i32 = 0
    const head: string = "GET /s/"
    for (let k: i32 = 0; k < toI32(head.length); k++) {
      request[n] = toU8(head.charCodeAt(k))
      n = n + 1
    }
    let digits: i64 = id
    const start: i32 = n
    do {
      request[n] = toU8(48 + toI32(digits % 10))
      n = n + 1
      digits = digits / 10
    } while (digits > 0)
    let a: i32 = start
    let b: i32 = n - 1
    while (a < b) {
      const t: u8 = request[a]
      request[a] = request[b]
      request[b] = t
      a = a + 1
      b = b - 1
    }
    const tail: string = " HTTP/1.1\r\nHost: x\r\n\r\n"
    for (let k: i32 = 0; k < toI32(tail.length); k++) {
      request[n] = toU8(tail.charCodeAt(k))
      n = n + 1
    }
    conn.feed(request, 0, n)
    let event: i32 = conn.next()
    while (event !== H1_NEED_MORE) {
      if (event === H1_REQUEST) {
        const p = conn.parser
        let sid: i64 = 0
        for (let k: i32 = p.targetStart + 3; k < p.targetEnd; k++) {
          sid = sid * 10 + toI64(p.head[k] - 48)
        }
        const s: Session = cache.touch(sid)
        conn.respond(200, noNames, noNames, toI32(s.payload.length))
        conn.write(s.payload, 0, toI32(s.payload.length))
        conn.end()
      } else if (event === H1_END) {
        checksum = (checksum * 31 + toI64(conn.outputEnd - conn.outputStart)) & 0xffffffffffff
        conn.consume(conn.outputEnd - conn.outputStart)
      }
      event = conn.next()
    }
    if ((r + 1) % every === 0) {
      console.log(
        `requests ${r + 1} made ${cache.made} held ${cache.held} mark ${Arena.mark()} used ${Arena.used()} anon ${anonBytes(argv, scratch, pages)}`
      )
    }
  }
  console.log(`checksum ${checksum}`)
  return 0
}
