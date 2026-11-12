// WP46 stage 3's proof (docs/wp46-long-running-memory.md §7): the server of
// `bench/wp46-memory/sessions.ts`, its sessions in regions, serves 2,000,000
// requests and its memory stays flat once its cache is full. One keep-alive
// `Http1Connection` is fed `GET /s/<id>` in memory; a client id comes from a
// population ten times the live set, so the cache churns and evicts the oldest
// session about nine requests in ten. A session is made by `regionWith`,
// served by `enterWith` and freed with its region on eviction, so the
// process's arena holds only what lives as long as the server.
//
// At every checkpoint the program reads `Arena.mark()`, the process arena's
// bump position, and the anonymous resident set. Past warm-up the mark must
// not move at all, and the set must stay within `SOAK_RSS_BOUND`. Then the
// same checks are run over the baseline's cache, whose sessions are in the
// process's arena, and must fail: an assertion that held with or without
// regions would prove nothing.
//
// `<requests> <live>` runs another size with the same checks, for
// measurement (the checksum is pinned only for the default):
//
//     build/test/link/region_sessions_soak/app 2000000 100000
import { fileClose, fileOpen, fileReadAt } from "nish:fs"
import { writeError } from "nish:io"
import { Region, enterWith, free, regionWith } from "nish:region"
import { H1_END, H1_NEED_MORE, H1_REQUEST, Http1Config, Http1Connection } from "nish/net/http1-server"
import { Suite } from "nish/testing"

/** The run `npm test` makes: §7's 2,000,000 requests over §1's 1,000 live sessions. */
const SOAK_REQUESTS: i64 = 2000000
const SOAK_LIVE: i32 = 1000
/** Requests between two checkpoints: twenty of them over the run. */
const SOAK_EVERY: i64 = 100000
/**
 * The responses' checksum over the default run, the same figure the baseline
 * prints for `sessions 2000000 1000`: the region server answers what the
 * baseline answers, byte for byte in length.
 */
const SOAK_CHECKSUM: i64 = 269280599213444
/**
 * How far the anonymous resident set may grow past warm-up over the whole run.
 * A session's region takes its chunks from `malloc` and gives them back on
 * `free`, so what the set holds past warm-up is the live set's chunks and
 * `malloc`'s free lists, whose shape drifts as sessions of 16 to 255 byte
 * payloads come and go: a page or two over 2,000,000 requests at 1,000 live,
 * and at 100,000 live a few pages. 512 KiB, the relay soak's bound, is well
 * above that drift and far below a leak: the baseline grows by about 168 bytes
 * a request, 16 MiB in one checkpoint interval.
 */
const SOAK_RSS_BOUND: i64 = 524288
/**
 * Warm-up, in turnovers of the live set: the checks start at the first
 * checkpoint at least this many times `live` requests in. Until then the
 * cache's `Map` is still growing to its last size — a delete leaves its entry
 * dead until a rebuild, so the entry arrays fill to three quarters of a bucket
 * table that doubles until the live entries are under half of that, about
 * 2.7 × `live`, and only then compact in place (std/collections.ts,
 * `rebuiltSlots`) — and `malloc`'s free lists are still taking the shape of
 * the sessions' chunks. At 100,000 live the soak measured both settle by 6 ×
 * `live`, the mark at 4 ×; 8 leaves a margin. At the default 1,000 live it is
 * inside the first checkpoint.
 */
const WARM_TURNS: i64 = 8
/** How far the baseline's run goes past its warm-up for the negative check: three checkpoints. */
const BASELINE_PAST: i64 = 300000

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

/** A session's payload size, 16 to 255 bytes, as the baseline's. */
const payloadSize = (id: i64): i32 => 16 + toI32(((id * 2654435761) >> 7) & 239)

const open = (id: i64): Session => new Session(id, payloadSize(id))

/** Copies the payload into the connection's buffer: only its length leaves the region. */
const serve = (s: Session, out: u8[]): i32 => {
  s.hits = s.hits + 1
  const n: i32 = toI32(s.payload.length)
  for (let k: i32 = 0; k < n && k < toI32(out.length); k++) {
    out[k] = s.payload[k]
  }
  return n
}

/** The cache on regions (§2.1): a region per session, the oldest freed once `live` are held. */
class RegionCache {
  regions: Map<i64, Region<Session>>
  /** Insertion order of the held ids, a ring of `live`. */
  order: i64[]
  head: i32 = 0
  held: i32 = 0
  constructor(live: i32) {
    this.regions = new Map<i64, Region<Session>>()
    this.order = new Array<i64>(live)
  }
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
    } else {
      this.held = this.held + 1
    }
    const r = regionWith(id, open)
    this.regions.set(id, r)
    this.order[this.head] = id
    this.head = (this.head + 1) % live
    return enterWith(r, out, serve)
  }
}

/** The baseline's cache (§1): every session in the process's arena, and an evicted one never given back. */
class ArenaCache {
  sessions: Map<i64, Session>
  order: i64[]
  head: i32 = 0
  held: i32 = 0
  constructor(live: i32) {
    this.sessions = new Map<i64, Session>()
    this.order = new Array<i64>(live)
  }
  get(id: i64, out: u8[]): i32 {
    const found: Session | undefined = this.sessions.get(id)
    if (found !== undefined) {
      return serve(found, out)
    }
    const live: i32 = toI32(this.order.length)
    if (this.held === live) {
      this.sessions.delete(this.order[this.head])
    } else {
      this.held = this.held + 1
    }
    const s: Session = open(id)
    this.sessions.set(id, s)
    this.order[this.head] = id
    this.head = (this.head + 1) % live
    return serve(s, out)
  }
}

/**
 * The anonymous resident set in bytes, /proc/self/statm's `resident` less its
 * `shared`, the pages no file backs, or -1. Read with `fileReadAt` into a
 * buffer made once, so a checkpoint allocates nothing: procfs answers the
 * current figures at offset 0 every time. Linux only, as /proc is.
 */
const anonResident = (fd: i32, buf: u8[]): i64 => {
  const got: i32 = fileReadAt(fd, buf, 0, toI32(buf.length), 0)
  let field: i32 = 0
  let value: i64 = 0
  let resident: i64 = 0
  let digits: boolean = false
  for (let k: i32 = 0; k < got && field < 3; k++) {
    const c: i32 = toI32(buf[k])
    if (c >= 48 && c <= 57) {
      value = value * 10 + toI64(c - 48)
      digits = true
    } else if (digits) {
      if (field === 1) {
        resident = value
      } else if (field === 2) {
        return (resident - value) * 4096
      }
      field = field + 1
      value = 0
      digits = false
    }
  }
  return -1
}

/** The requests warm-up takes at `live` sessions: `WARM_TURNS` turnovers, rounded up to a checkpoint. */
const warmRequests = (live: i32): i64 => {
  const turns: i64 = WARM_TURNS * toI64(live)
  return turns <= SOAK_EVERY ? SOAK_EVERY : ((turns + SOAK_EVERY - 1) / SOAK_EVERY) * SOAK_EVERY
}

/**
 * What one run measured: a checkpoint every `SOAK_EVERY` requests, the one at
 * `warm` the end of warm-up that the checks compare the later ones against,
 * and the responses' checksum.
 */
class Soak {
  marks: i64[]
  anons: i64[]
  warm: i32
  checksum: i64 = 0
  served: i64 = 0
  constructor(requests: i64, warmUp: i64) {
    this.marks = new Array<i64>(toI32(requests / SOAK_EVERY))
    this.anons = new Array<i64>(toI32(requests / SOAK_EVERY))
    this.warm = toI32(warmUp / SOAK_EVERY) - 1
  }
}

/**
 * Serves `requests` requests through one keep-alive connection, from the
 * region cache or the baseline's, and checkpoints into `soak`. Everything the
 * loop allocates per request is a session (in its region, or the baseline's
 * arena); the request and response buffers are made once, before the first
 * checkpoint.
 */
const run = (soak: Soak, regions: boolean, requests: i64, live: i32): void => {
  const statm: i32 = fileOpen("/proc/self/statm")
  const text: u8[] = new Array<u8>(128)
  const inRegions: RegionCache = new RegionCache(regions ? live : 1)
  const inArena: ArenaCache = new ArenaCache(regions ? 1 : live)
  const conn: Http1Connection = new Http1Connection(new Http1Config())
  const request: u8[] = new Array<u8>(64)
  const out: u8[] = new Array<u8>(256)
  const noNames: u8[][] = []
  const head: string = "GET /s/"
  const tail: string = " HTTP/1.1\r\nHost: x\r\n\r\n"
  let x: i64 = 2463534242
  for (let r: i64 = 0; r < requests; r++) {
    // xorshift, as the baseline's: a client id from a population ten times the live set
    x = x ^ (x << 13)
    x = x ^ (x >> 7)
    x = x ^ (x << 17)
    const id: i64 = ((x >> 1) & 0x7fffffff) % (toI64(live) * 10)
    let n: i32 = 0
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
        const length: i32 = regions ? inRegions.get(sid, out) : inArena.get(sid, out)
        conn.respond(200, noNames, noNames, length)
        conn.write(out, 0, length)
        conn.end()
      } else if (event === H1_END) {
        soak.checksum = (soak.checksum * 31 + toI64(conn.outputEnd - conn.outputStart)) & 0xffffffffffff
        soak.served = soak.served + 1
        conn.consume(conn.outputEnd - conn.outputStart)
      }
      event = conn.next()
    }
    if ((r + 1) % SOAK_EVERY === 0) {
      const at: i32 = toI32((r + 1) / SOAK_EVERY) - 1
      soak.marks[at] = Arena.mark()
      soak.anons[at] = statm >= 0 ? anonResident(statm, text) : -1
    }
  }
  if (statm >= 0) {
    fileClose(statm)
  }
}

/** Past the warm-up checkpoint: the cache full and every buffer at its last size. */
const markMoved = (soak: Soak): i64 => soak.marks[soak.marks.length - 1] - soak.marks[soak.warm]

const anonGrew = (soak: Soak): i64 => soak.anons[soak.anons.length - 1] - soak.anons[soak.warm]

/** Whether the mark held at every checkpoint past warm-up, not only at the last. */
const markFlat = (soak: Soak): boolean => {
  if (soak.warm < 0 || soak.warm + 1 >= toI32(soak.marks.length)) {
    return false // no checkpoint past warm-up, so nothing was shown flat
  }
  for (let k: i32 = soak.warm + 1; k < toI32(soak.marks.length); k++) {
    if (soak.marks[k] !== soak.marks[soak.warm]) {
      return false
    }
  }
  return true
}

/** Whether the resident set was read at every checkpoint past warm-up and stayed within the bound of warm-up's at each. */
const anonFlat = (soak: Soak): boolean => {
  if (soak.warm < 0 || soak.warm + 1 >= toI32(soak.anons.length)) {
    return false
  }
  for (let k: i32 = soak.warm; k < toI32(soak.anons.length); k++) {
    if (soak.anons[k] <= 0 || soak.anons[k] - soak.anons[soak.warm] > SOAK_RSS_BOUND) {
      return false
    }
  }
  return true
}

const figures = (soak: Soak, past: i64): string =>
  `after warm-up: mark ${soak.marks[soak.warm]}, anonymous resident ${soak.anons[soak.warm]} bytes; after ${past} more requests: mark ${soak.marks[soak.marks.length - 1]} (${markMoved(soak)} bytes moved), anonymous resident ${soak.anons[soak.anons.length - 1]} bytes (${anonGrew(soak)} more)`

export const main = (): i32 => {
  const custom: boolean = process.argv.length === 3
  const requests: i64 = custom ? toI64(Number(process.argv[1])) : SOAK_REQUESTS
  const live: i32 = custom ? toI32(Number(process.argv[2])) : SOAK_LIVE
  const t = new Suite("region sessions soak")
  const warmUp: i64 = warmRequests(live)
  const past: i64 = requests - warmUp
  const soak: Soak = new Soak(requests, warmUp)
  run(soak, true, requests, live)
  // The figures, on stderr: stdout is the checks alone, which `expected.out` pins.
  writeError(`region_sessions_soak: regions, ${live} live: ${figures(soak, past)}\n`)
  const answered: string = `${requests} requests served from sessions in regions, ${live} live`
  if (soak.served === requests && (custom || soak.checksum === SOAK_CHECKSUM)) {
    t.pass(answered)
  } else {
    t.fail(answered, `${soak.served} served, checksum ${soak.checksum} against the baseline's ${SOAK_CHECKSUM}`)
  }
  const flatMark: string = `Arena.mark() flat over ${past} requests past warm-up: the same position at every checkpoint`
  if (markFlat(soak)) {
    t.pass(flatMark)
  } else {
    t.fail(flatMark, figures(soak, past))
  }
  const flatResident: string = `anonymous resident memory flat over ${past} requests past warm-up, within ${SOAK_RSS_BOUND} bytes at every checkpoint`
  if (anonFlat(soak)) {
    t.pass(flatResident)
  } else {
    t.fail(flatResident, figures(soak, past))
  }
  // The negative: the same checks over the baseline's cache, after the region run so its growth cannot touch that run's figures.
  const basePast: i64 = BASELINE_PAST
  const base: Soak = new Soak(warmUp + basePast, warmUp)
  run(base, false, warmUp + basePast, live)
  writeError(`region_sessions_soak: baseline, ${live} live: ${figures(base, basePast)}\n`)
  const fails: string = `the same checks fail on the baseline's cache over ${basePast} requests, its sessions in the process's arena`
  if (!markFlat(base) && !anonFlat(base)) {
    t.pass(fails)
  } else {
    t.fail(fails, figures(base, basePast))
  }
  // `npm test`'s run answers 0 whatever it found, and its stdout carries the verdict, as net_relay_soak's does.
  t.done()
  return 0
}
