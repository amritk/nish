// WP46 stage 3: the server of `sessions.ts` with each session in a region of
// its own. The requests, the ids, the payloads and the checkpoint lines are
// the baseline's; what differs is the `Cache` (docs/wp46-long-running-memory.md
// §2.1): a session is made by `regionWith`, served by `enterWith`, which copies
// its payload into the connection's buffer so only a length leaves, and freed
// with its region when it is evicted. The process's arena then holds only what
// lives as long as the server, and the figures stay flat past warm-up.
//
//   build/nish bench/wp46-memory/sessions-region.ts --link build/wp46/sessions-region
//   build/wp46/sessions-region <requests> <live> <every>
import { readFileSyncOrNull } from "nish:fs"
import { spawnSyncTo } from "nish:process"
import { Region, enterWith, free, regionWith } from "nish:region"
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

const open = (id: i64): Session => new Session(id, 16 + toI32(((id * 2654435761) >> 7) & 239))

/** Copies the payload into the connection's buffer: only its length leaves the region. */
const serve = (s: Session, out: u8[]): i32 => {
  s.hits = s.hits + 1
  const n: i32 = toI32(s.payload.length)
  for (let k: i32 = 0; k < n; k++) {
    out[k] = s.payload[k]
  }
  return n
}

class Cache {
  regions: Map<i64, Region<Session>>
  /** Insertion order of the held ids, a ring of `live`: the oldest is evicted first. */
  order: i64[]
  head: i32 = 0
  held: i32 = 0
  made: i64 = 0
  constructor(live: i32) {
    this.regions = new Map<i64, Region<Session>>()
    this.order = new Array<i64>(live)
  }

  /** Serves `id`'s session into `out`, making it if it is not held; answers the payload's length. */
  get(id: i64, out: u8[]): i32 {
    const hit = this.regions.get(id)
    if (hit !== undefined) {
      return enterWith(hit, out, serve)
    }
    const live: i32 = toI32(this.order.length)
    if (this.held === live) {
      const old: i64 = this.order[this.head]
      const gone = this.regions.get(old)
      if (gone !== undefined) {
        free(gone)
        this.regions.delete(old)
      }
      this.held = this.held - 1
    }
    const r = regionWith(id, open)
    this.regions.set(id, r)
    this.order[this.head] = id
    this.head = (this.head + 1) % live
    this.held = this.held + 1
    this.made = this.made + 1
    return enterWith(r, out, serve)
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
  const scratch: string = "/tmp/wp46-sessions-region.statm"
  const pages: i64[] = [0, 0, 0]
  const cache: Cache = new Cache(live)
  const conn: Http1Connection = new Http1Connection(new Http1Config())
  const request: u8[] = new Array<u8>(64)
  const out: u8[] = new Array<u8>(256)
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
        const length: i32 = cache.get(sid, out)
        conn.respond(200, noNames, noNames, length)
        conn.write(out, 0, length)
        conn.end()
      } else if (event === H1_END) {
        checksum = (checksum * 31 + toI64(conn.outputEnd - conn.outputStart)) & 0xffffffffffff
        conn.consume(conn.outputEnd - conn.outputStart)
      }
      event = conn.next()
    }
    if ((r + 1) % every === 0) {
      // Read before the line is built, which the block then releases: the
      // baseline's own lines stay in its arena, a few hundred bytes a
      // checkpoint, lost in its growth but not in this server's flat figures.
      const mark: i64 = Arena.mark()
      const used: i64 = Arena.used()
      using _scope = arena()
      console.log(
        `requests ${r + 1} made ${cache.made} held ${cache.held} mark ${mark} used ${used} anon ${anonBytes(argv, scratch, pages)}`
      )
    }
  }
  console.log(`checksum ${checksum}`)
  return 0
}
