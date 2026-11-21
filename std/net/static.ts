/**
 * `nish/net/static` — serves the files under one directory through
 * `nish/net/http-server` (HTTP/1.1, HTTP/2 over TLS and cleartext, HTTP/3)
 * or through `nish/net/handler` (HTTP/1.1), with a content type per
 * extension, an ETag and a Last-Modified, a single byte range, and a path
 * check that refuses to leave the directory.
 *
 *     import { HANDLER_SENT } from "nish/net/handler"
 *     import { STATIC_NOT_FOUND, StaticFiles, StaticLimits } from "nish/net/static"
 *
 *     const ASSETS: i32 = 0
 *     router.add("GET", "/assets/*")
 *     router.add("HEAD", "/assets/*")
 *     const files = new StaticFiles("./public", new StaticLimits())
 *     // per request:
 *     case ASSETS: {
 *       const sent: i32 = files.serve(server, r, r.paramStart(0), r.paramEnd(0))
 *       if (sent === STATIC_NOT_FOUND) server.empty(r, 404)
 *     }
 *
 * **The path is the program's span, decoded and checked.** `serve` takes a
 * `[start, end)` span of the request's head, the rest of the path a `*`
 * route gave, percent-decodes it strictly (`%00` and a bad escape are
 * refused) and splits it on `/`. A segment that is empty (`a//b`), `.`, `..`
 * or any other name that starts with a dot, or that holds a backslash or a
 * control byte, refuses the whole path. What is left is joined under the
 * root and resolved with `realpathSync`, and a result that is not the root's
 * own real path or under it is refused too, so a symbolic link that leads
 * out is not followed out. A refused path answers `STATIC_NOT_FOUND` with
 * `refused` set; the program answers it, as it answers a missing file.
 *
 * **The cache follows the disk.** Each file of at most
 * `StaticLimits.maxCachedBytes` is kept in one of `maxEntries` slots, keyed
 * by its decoded path and its coding; every request stats the file again, and
 * a slot whose modification time or size differs is read again before it is
 * sent. A larger file is read from disk for each request, a chunk at a time.
 * Nothing is cached by URL, and no response is cached.
 *
 * **A precompressed sibling is sent when it is asked for.** With
 * `precompressed` on, a request whose `Accept-Encoding` offers `br` or `gzip`
 * is sent `name.br` or `name.gz` when that file exists beside `name`, with a
 * `Content-Encoding`, the base name's content type and an ETag of its own.
 * Codings are weighed by their q-values; a tie goes to `br`, then `gzip`,
 * then the file as it is. With it on, every answer says `Vary: Accept-Encoding`.
 *
 * **Validators and ranges.** The ETag is strong, `"<size>-<mtime µs>"` in
 * hex, with `-br` or `-gz` for a coded variant. `If-None-Match` (weak
 * comparison, or `*`) answers 304; without it, an `If-Modified-Since` in the
 * IMF-fixdate form at or after the file's second answers 304, and another
 * date form is ignored. One `bytes=` range answers 206 with its
 * `Content-Range`; more than one sends the whole file; a malformed or
 * unsatisfiable one answers 416. `If-Range` keeps the range only for an
 * equal strong ETag or the exact Last-Modified date. A range on a coded
 * variant counts the coded bytes.
 *
 * **What it reaches.** `fs.read` for the files under the root and `clock`
 * for their modification times; `--sandbox --allow fs.read=<root>` holds
 * the reads to the directory. The record is `docs/security/static.md`.
 */

import { realpathSync, statMtimeSync } from "nish:fs"
import { copyBytes } from "nish/bytes"
import { HANDLER_SENT, HttpHandler, HttpRequest } from "nish/net/handler"
import { HTTP_DATE_SIZE, httpDateWrite, httpFieldBytes } from "nish/net/http-fields"
import { HttpServer, HttpServerRequest } from "nish/net/http-server"
import { percentDecode } from "nish/net/url"

/** What `serve` answers when it sent nothing: the file is missing or not a regular file, or the path was refused (`refused`). */
export const STATIC_NOT_FOUND: i32 = -30

/** The coding of the file as it is on disk. */
const STATIC_IDENTITY: i32 = 0
/** The `name.br` sibling. */
const STATIC_BR: i32 = 1
/** The `name.gz` sibling. */
const STATIC_GZIP: i32 = 2

/** The largest file `serve` answers: a body length is an `i32`. */
const STATIC_MAX_FILE: i64 = 2147483647

/** How many bytes one streamed read takes. */
const STATIC_CHUNK: i32 = 65536

/** The most cache entries `StaticLimits.maxEntries` may ask for. */
const STATIC_MAX_ENTRIES: i32 = 4096
/** The longest path span `StaticLimits.maxPath` may ask for. */
const STATIC_MAX_PATH: i32 = 4096

/** What `StaticFiles` holds and reads. */
export class StaticLimits {
  /** How many files the cache keeps at once. */
  maxEntries: i32 = 32
  /** The largest file the cache keeps, at most 2^30; a larger one is read from disk on each request. */
  maxCachedBytes: i32 = 262144
  /** The longest path span `serve` takes, before decoding; a longer one is refused. */
  maxPath: i32 = 1024
  /** Whether a `name.br` or `name.gz` beside `name` is sent when `Accept-Encoding` offers it. */
  precompressed: boolean = true
  /** Whether an empty path, or one that ends in `/`, serves `index.html` there. */
  index: boolean = true
}

/**
 * The extensions `staticContentType` knows, in small letters, each followed
 * by a space, its content type and a `|`.
 */
const STATIC_TYPES: string =
  "html text/html; charset=utf-8|" +
  "htm text/html; charset=utf-8|" +
  "css text/css; charset=utf-8|" +
  "js text/javascript; charset=utf-8|" +
  "mjs text/javascript; charset=utf-8|" +
  "json application/json|" +
  "map application/json|" +
  "svg image/svg+xml|" +
  "webp image/webp|" +
  "woff2 font/woff2|" +
  "woff font/woff|" +
  "png image/png|" +
  "jpg image/jpeg|" +
  "jpeg image/jpeg|" +
  "gif image/gif|" +
  "ico image/x-icon|" +
  "avif image/avif|" +
  "txt text/plain; charset=utf-8|" +
  "wasm application/wasm|" +
  "xml application/xml|" +
  "pdf application/pdf|" +
  "mp4 video/mp4|"

/** `b` with an ASCII capital letter made small. */
const staticLower = (b: i32): i32 => (b >= 65 && b <= 90 ? b + 32 : b)

/**
 * The content type `serve` sends for a file name, by its extension (ASCII
 * case is ignored); `application/octet-stream` for one the table lacks.
 * @param name the file name, or a path ending in it
 * @returns the `Content-Type` value
 */
export const staticContentType = (name: string): string => {
  let dot: i32 = -1
  for (let k: i32 = name.length - 1; k >= 0 && dot < 0; k--) {
    const c: i32 = name.charCodeAt(k)
    if (c === 47) {
      return "application/octet-stream"
    }
    if (c === 46) {
      dot = k
    }
  }
  if (dot < 0) {
    return "application/octet-stream"
  }
  const length: i32 = name.length - dot - 1
  let at: i32 = 0
  while (at < STATIC_TYPES.length) {
    let k: i32 = 0
    while (k < length && STATIC_TYPES.charCodeAt(at + k) === staticLower(name.charCodeAt(dot + 1 + k))) {
      k++
    }
    const space: i32 = STATIC_TYPES.indexOf(" ", at)
    const bar: i32 = STATIC_TYPES.indexOf("|", space)
    if (k === length && space === at + length) {
      return STATIC_TYPES.substring(space + 1, bar)
    }
    at = bar + 1
  }
  return "application/octet-stream"
}

/** Whether `bytes[start .. end)` is `text`, ASCII case ignored. */
const staticIs = (bytes: u8[], start: i32, end: i32, text: string): boolean => {
  if (end - start !== text.length) {
    return false
  }
  for (let k: i32 = 0; k < text.length; k++) {
    if (staticLower(toI32(bytes[start + k])) !== staticLower(text.charCodeAt(k))) {
      return false
    }
  }
  return true
}

/** Whether `b` is a space or a tab. */
const staticSpace = (b: i32): boolean => b === 32 || b === 9

/** Writes `v` (0 or more) in lowercase hex at `out[at ..)` and answers the index past it. */
const staticHex = (out: u8[], at: i32, v: i64): i32 => {
  let digits: i32 = 1
  let rest: i64 = v >> 4
  while (rest > 0) {
    digits++
    rest = rest >> 4
  }
  let x: i64 = v
  for (let k: i32 = digits - 1; k >= 0; k--) {
    const d: i32 = toI32(x & 15)
    out[at + k] = toU8(d < 10 ? 48 + d : 87 + d)
    x = x >> 4
  }
  return at + digits
}

/** Writes `v` (0 or more) in decimal at `out[at ..)` and answers the index past it. */
const staticDecimal = (out: u8[], at: i32, v: i64): i32 => {
  let digits: i32 = 1
  let rest: i64 = v / 10
  while (rest > 0) {
    digits++
    rest = rest / 10
  }
  let x: i64 = v
  for (let k: i32 = digits - 1; k >= 0; k--) {
    out[at + k] = toU8(48 + toI32(x % 10))
    x = x / 10
  }
  return at + digits
}

/** The two digits at `b[at ..)` as a number, or -1. */
const staticTwo = (b: u8[], at: i32): i32 => {
  const hi: i32 = toI32(b[at]) - 48
  const lo: i32 = toI32(b[at + 1]) - 48
  return hi < 0 || hi > 9 || lo < 0 || lo > 9 ? -1 : 10 * hi + lo
}

/** The month names, three letters each from January. */
const STATIC_MONTHS: string = "JanFebMarAprMayJunJulAugSepOctNovDec"

/**
 * The IMF-fixdate at `b[start .. end)` (`Sun, 06 Nov 1994 08:49:37 GMT`) as
 * seconds since 1970, or -1 for anything else: the obsolete RFC 850 and
 * asctime forms are not read.
 */
const staticDate = (b: u8[], start: i32, end: i32): i64 => {
  if (end - start !== HTTP_DATE_SIZE || b[start + 3] !== 44 || b[start + 4] !== 32) {
    return -1
  }
  const at: i32 = start + 5
  const day: i32 = staticTwo(b, at)
  let month: i32 = -1
  for (let m: i32 = 0; m < 12; m++) {
    if (
      toI32(b[at + 3]) === STATIC_MONTHS.charCodeAt(3 * m) &&
      toI32(b[at + 4]) === STATIC_MONTHS.charCodeAt(3 * m + 1) &&
      toI32(b[at + 5]) === STATIC_MONTHS.charCodeAt(3 * m + 2)
    ) {
      month = m + 1
    }
  }
  const century: i32 = staticTwo(b, at + 7)
  const years: i32 = staticTwo(b, at + 9)
  const hour: i32 = staticTwo(b, at + 12)
  const minute: i32 = staticTwo(b, at + 15)
  const second: i32 = staticTwo(b, at + 18)
  if (
    day < 1 ||
    day > 31 ||
    month < 0 ||
    century < 0 ||
    years < 0 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 60 ||
    !staticIs(b, at + 20, at + 24, " GMT") ||
    b[at + 2] !== 32 ||
    b[at + 6] !== 32 ||
    b[at + 11] !== 32 ||
    b[at + 14] !== 58 ||
    b[at + 17] !== 58
  ) {
    return -1
  }
  // Days from 1970-01-01 to the civil date (Howard Hinnant's days_from_civil).
  const year: i64 = toI64(100 * century + years - (month <= 2 ? 1 : 0))
  const era: i64 = year / 400
  const yearOfEra: i64 = year - era * 400
  const mp: i64 = toI64(month > 2 ? month - 3 : month + 9)
  const dayOfYear: i64 = (153 * mp + 2) / 5 + toI64(day - 1)
  const dayOfEra: i64 = yearOfEra * 365 + yearOfEra / 4 - yearOfEra / 100 + dayOfYear
  const days: i64 = era * 146097 + dayOfEra - 719468
  return days * 86400 + toI64(3600 * hour + 60 * minute + second)
}

/**
 * The decimal digits at `b[start .. end)` as a number, or -1 for none, a
 * byte that is not a digit, or more than 18 digits.
 */
const staticNumber = (b: u8[], start: i32, end: i32): i64 => {
  if (end <= start || end - start > 18) {
    return -1
  }
  let n: i64 = 0
  for (let k: i32 = start; k < end; k++) {
    const d: i32 = toI32(b[k]) - 48
    if (d < 0 || d > 9) {
      return -1
    }
    n = n * 10 + toI64(d)
  }
  return n
}

/**
 * The q-value at `b[start .. end)` in thousandths (`0`, `1`, `0.5`,
 * `1.000`), or -1 when it is not one.
 */
const staticQ = (b: u8[], start: i32, end: i32): i32 => {
  if (end <= start || end - start > 5) {
    return -1
  }
  const whole: i32 = toI32(b[start]) - 48
  if (whole < 0 || whole > 1) {
    return -1
  }
  if (end - start === 1) {
    return 1000 * whole
  }
  if (b[start + 1] !== 46) {
    return -1
  }
  let q: i32 = 1000 * whole
  let scale: i32 = 100
  for (let k: i32 = start + 2; k < end; k++) {
    const d: i32 = toI32(b[k]) - 48
    if (d < 0 || d > 9) {
      return -1
    }
    q += scale * d
    scale = scale / 10
  }
  return q > 1000 ? -1 : q
}

/** A new array of `src[0 .. length)`. */
const staticCut = (src: u8[], length: i32): u8[] => {
  const out: u8[] = new Array<u8>(length)
  copyBytes(out, 0, src, 0, length)
  return out
}

/** Serves the files under one directory; one per server, not reentrant. */
export class StaticFiles {
  /** The root's real path, or `""` when it did not resolve (then every request is not found). */
  root: string
  /** A copy of the limits the constructor was given, within their ranges. */
  private limits: StaticLimits
  /** Whether the last `serve` that answered `STATIC_NOT_FOUND` refused the path rather than missing the file. */
  refused: boolean = false
  /** The status the last `serve` sent, or 0 when it sent none. */
  status: i32 = 0

  /** The decoded path, then the relative name it serves. @internal Written by `staticPlan`. */
  path: u8[]
  /** How many bytes of `path` are the name. @internal */
  pathLength: i32 = 0
  /** The ETag the plan made, `etag[0 .. etagLength)`. @internal */
  etag: u8[]
  /** @internal */
  etagLength: i32 = 0
  /** One streamed read. @internal */
  chunk: u8[]
  /** The open file the plan chose, or -1. @internal */
  fd: i32 = -1
  /** Its coding, a `STATIC_*` value. @internal */
  coding: i32 = 0
  /** Its size. @internal */
  size: i64 = 0
  /** Its modification time in milliseconds. @internal */
  mtime: f64 = 0
  /** The first byte sent and one past the last. @internal */
  from: i64 = 0
  /** @internal */
  to: i64 = 0
  /** The cache slot holding the bytes, or -1 to stream from `fd`. @internal */
  slot: i32 = -1
  /** The q-values `Accept-Encoding` gave `br`, `gzip` and the file as it is, in thousandths. @internal */
  qBr: i32 = 0
  /** @internal */
  qGzip: i32 = 0
  /** @internal */
  qIdentity: i32 = 1000

  /** The request's fields, as `[start, end)` spans of its head, -1 when absent. @internal Copied by each wrapper. */
  acceptStart: i32 = -1
  /** @internal */
  acceptEnd: i32 = -1
  /** @internal */
  noneMatchStart: i32 = -1
  /** @internal */
  noneMatchEnd: i32 = -1
  /** @internal */
  sinceStart: i32 = -1
  /** @internal */
  sinceEnd: i32 = -1
  /** @internal */
  rangeStart: i32 = -1
  /** @internal */
  rangeEnd: i32 = -1
  /** @internal */
  ifRangeStart: i32 = -1
  /** @internal */
  ifRangeEnd: i32 = -1

  /** The cache keys, `maxEntries` strides of `path.length` bytes. @internal */
  keys: u8[]
  /** How many bytes of each key are used, -1 for an empty slot. @internal */
  keyLength: i32[]
  /** Each key's coding. @internal */
  keyCoding: i32[]
  /** Each slot's bytes, `bytes[k][0 .. sizes[k])`. @internal */
  bytes: u8[][]
  /** @internal */
  sizes: i64[]
  /** @internal */
  mtimes: f64[]
  /** The next slot to replace. @internal */
  hand: i32 = 0

  /**
   * A server of the files under `root`, which is resolved once, now. Limits
   * out of range (`maxEntries` or `maxPath` outside 1 to 4096, or a
   * `maxCachedBytes` outside 0 to 2^30) leave the root empty, so every GET or
   * HEAD is not found.
   * @param root the directory to serve
   * @param limits the cache and path limits
   */
  constructor(root: string, limits: StaticLimits) {
    const ok: boolean =
      limits.maxEntries >= 1 &&
      limits.maxEntries <= STATIC_MAX_ENTRIES &&
      limits.maxPath >= 1 &&
      limits.maxPath <= STATIC_MAX_PATH &&
      limits.maxCachedBytes >= 0 &&
      limits.maxCachedBytes <= 1073741824
    const real: string | null = ok ? realpathSync(root) : null
    this.root = real === null ? "" : real
    // A copy, so a program that changes its limits later cannot outgrow the arrays sized here.
    const own = new StaticLimits()
    own.maxCachedBytes = ok ? limits.maxCachedBytes : 0
    own.precompressed = limits.precompressed
    own.index = limits.index
    this.limits = own
    let entries: i32 = 1
    let room: i32 = 17
    const asked: i32 = limits.maxEntries
    const longest: i32 = limits.maxPath
    // Literal bounds, so the prover sees that the sum and product cannot overflow.
    if (ok && asked <= 4096 && longest <= 4096 && asked >= 1 && longest >= 1) {
      entries = asked
      room = longest + 16
    }
    own.maxEntries = entries
    own.maxPath = room - 16
    this.path = new Array<u8>(room)
    this.keys = new Array<u8>(entries * room)
    this.etag = new Array<u8>(48)
    this.chunk = new Array<u8>(STATIC_CHUNK)
    this.keyLength = new Array<i32>(entries)
    this.keyCoding = new Array<i32>(entries)
    this.sizes = new Array<i64>(entries)
    this.mtimes = new Array<f64>(entries)
    const slots: u8[][] = []
    for (let k: i32 = 0; k < entries; k++) {
      this.keyLength[k] = -1
      slots.push(new Array<u8>(0))
    }
    this.bytes = slots
  }

  /**
   * Serves the file `r`'s head names at `[pathStart, pathEnd)`, a path
   * relative to the root (one leading `/` is dropped), through `server`.
   * @param server the server `r` came from
   * @param r a request taken and not yet answered
   * @param pathStart where the path starts in `r.head`
   * @param pathEnd one past its last byte
   * @returns `HANDLER_SENT`, `HANDLER_DROPPED`, or `STATIC_NOT_FOUND` with nothing sent
   */
  serve(server: HttpServer, r: HttpServerRequest, pathStart: i32, pathEnd: i32): i32 {
    const ae: i32 = r.header("accept-encoding")
    this.acceptStart = ae < 0 ? -1 : r.valueStart(ae)
    this.acceptEnd = ae < 0 ? -1 : r.valueEnd(ae)
    const nm: i32 = r.header("if-none-match")
    this.noneMatchStart = nm < 0 ? -1 : r.valueStart(nm)
    this.noneMatchEnd = nm < 0 ? -1 : r.valueEnd(nm)
    const ims: i32 = r.header("if-modified-since")
    this.sinceStart = ims < 0 ? -1 : r.valueStart(ims)
    this.sinceEnd = ims < 0 ? -1 : r.valueEnd(ims)
    const rg: i32 = r.header("range")
    this.rangeStart = rg < 0 ? -1 : r.valueStart(rg)
    this.rangeEnd = rg < 0 ? -1 : r.valueEnd(rg)
    const ir: i32 = r.header("if-range")
    this.ifRangeStart = ir < 0 ? -1 : r.valueStart(ir)
    this.ifRangeEnd = ir < 0 ? -1 : r.valueEnd(ir)
    const head: boolean = r.methodIs("HEAD")
    const status: i32 = this.staticPlan(r.head, pathStart, pathEnd, head || r.methodIs("GET"), head)
    if (status === STATIC_NOT_FOUND) {
      return STATIC_NOT_FOUND
    }
    const names: u8[][] = []
    const values: u8[][] = []
    this.staticFields(status, names, values)
    let sent: i32 = server.start(r, status, names, values, toI32(this.staticBodyLength(status)))
    if (sent === HANDLER_SENT && !head && this.staticBodyLength(status) > 0) {
      let pos: i64 = this.from
      while (sent === HANDLER_SENT && pos < this.to) {
        const n: i32 = this.staticFill(pos)
        sent = server.write(
          r,
          this.slot >= 0 ? this.bytes[this.slot] : this.chunk,
          this.slot >= 0 ? toI32(pos) : 0,
          n
        )
        pos += toI64(n)
      }
    }
    this.staticClose()
    return sent === HANDLER_SENT ? server.end(r) : sent
  }

  /**
   * `serve` through `nish/net/handler`'s HTTP/1.1 carrier.
   * @param h the handler `r` came from
   * @param r a request taken and not yet answered
   * @param pathStart where the path starts in `r.head`
   * @param pathEnd one past its last byte
   * @returns `HANDLER_SENT`, `HANDLER_DROPPED`, or `STATIC_NOT_FOUND` with nothing sent
   */
  serveHandler(h: HttpHandler, r: HttpRequest, pathStart: i32, pathEnd: i32): i32 {
    const ae: i32 = r.header("accept-encoding")
    this.acceptStart = ae < 0 ? -1 : r.valueStart(ae)
    this.acceptEnd = ae < 0 ? -1 : r.valueEnd(ae)
    const nm: i32 = r.header("if-none-match")
    this.noneMatchStart = nm < 0 ? -1 : r.valueStart(nm)
    this.noneMatchEnd = nm < 0 ? -1 : r.valueEnd(nm)
    const ims: i32 = r.header("if-modified-since")
    this.sinceStart = ims < 0 ? -1 : r.valueStart(ims)
    this.sinceEnd = ims < 0 ? -1 : r.valueEnd(ims)
    const rg: i32 = r.header("range")
    this.rangeStart = rg < 0 ? -1 : r.valueStart(rg)
    this.rangeEnd = rg < 0 ? -1 : r.valueEnd(rg)
    const ir: i32 = r.header("if-range")
    this.ifRangeStart = ir < 0 ? -1 : r.valueStart(ir)
    this.ifRangeEnd = ir < 0 ? -1 : r.valueEnd(ir)
    const head: boolean = r.methodIs("HEAD")
    const status: i32 = this.staticPlan(r.head, pathStart, pathEnd, head || r.methodIs("GET"), head)
    if (status === STATIC_NOT_FOUND) {
      return STATIC_NOT_FOUND
    }
    const names: u8[][] = []
    const values: u8[][] = []
    this.staticFields(status, names, values)
    let sent: i32 = h.start(r, status, names, values, toI32(this.staticBodyLength(status)))
    if (sent === HANDLER_SENT && !head && this.staticBodyLength(status) > 0) {
      let pos: i64 = this.from
      while (sent === HANDLER_SENT && pos < this.to) {
        const n: i32 = this.staticFill(pos)
        sent = h.write(
          r,
          this.slot >= 0 ? this.bytes[this.slot] : this.chunk,
          this.slot >= 0 ? toI32(pos) : 0,
          n
        )
        pos += toI64(n)
      }
    }
    this.staticClose()
    return sent === HANDLER_SENT ? h.end(r) : sent
  }

  /**
   * Decides the answer to a request whose fields the wrapper copied: 405 for
   * a method other than GET and HEAD, `STATIC_NOT_FOUND`, or 200, 206, 304 or
   * 416 with the file open on `fd` and its bytes in a slot when they fit.
   * @internal Called by `serve` and `serveHandler`.
   */
  staticPlan(head: u8[], pathStart: i32, pathEnd: i32, allowed: boolean, quiet: boolean): i32 {
    this.refused = false
    this.status = 0
    this.fd = -1
    this.slot = -1
    if (!allowed) {
      this.status = 405
      return 405
    }
    if (this.root.length === 0 || this.staticResolve(head, pathStart, pathEnd) !== 0) {
      return STATIC_NOT_FOUND
    }
    if (this.size > STATIC_MAX_FILE) {
      this.staticClose()
      return STATIC_NOT_FOUND
    }
    this.staticTag()
    this.from = 0
    this.to = this.size
    let status: i32 = 200
    if (this.noneMatchStart >= 0) {
      if (this.staticNoneMatch(head)) {
        status = 304
      }
    } else if (this.sinceStart >= 0) {
      const since: i64 = staticDate(head, this.sinceStart, this.sinceEnd)
      const last: i64 = this.staticSecond()
      if (since >= 0 && last >= 0 && last <= since) {
        status = 304
      }
    }
    if (status === 200 && this.rangeStart >= 0 && !quiet) {
      status = this.staticRange(head)
    }
    if (status === 200 || status === 206) {
      this.staticLoad()
    }
    this.status = status
    return status
  }

  /**
   * Decodes and checks the path, resolves it under the root, chooses the
   * coding and opens the file: 0, or `STATIC_NOT_FOUND` with `refused` set
   * for a path that was refused.
   * @internal Called by `staticPlan`.
   */
  staticResolve(head: u8[], pathStart: i32, pathEnd: i32): i32 {
    using _scope = arena()
    const length: i32 = pathEnd - pathStart
    if (length < 0 || length > this.limits.maxPath) {
      this.refused = true
      return STATIC_NOT_FOUND
    }
    const path: u8[] = this.path
    const decoded: i32 = percentDecode(head, pathStart, length, path, 0, 0)
    if (decoded < 0) {
      this.refused = true
      return STATIC_NOT_FOUND
    }
    const skip: i32 = decoded > 0 && path[0] === 47 ? 1 : 0
    let m: i32 = decoded - skip
    for (let k: i32 = 0; k < m; k++) {
      path[k] = path[k + skip]
    }
    if (m === 0 || path[m - 1] === 47) {
      if (!this.limits.index) {
        return STATIC_NOT_FOUND
      }
      const index: string = "index.html"
      for (let k: i32 = 0; k < index.length; k++) {
        path[m + k] = toU8(index.charCodeAt(k))
      }
      m += index.length
    }
    let segment: i32 = 0
    for (let k: i32 = 0; k <= m; k++) {
      if (k === m || path[k] === 47) {
        if (k === segment || path[segment] === 46) {
          this.refused = true
          return STATIC_NOT_FOUND
        }
        segment = k + 1
      } else {
        const b: i32 = toI32(path[k])
        if (b < 32 || b === 127 || b === 92) {
          this.refused = true
          return STATIC_NOT_FOUND
        }
      }
    }
    this.pathLength = m
    const base: string = this.root + "/" + String.fromBytes(path, 0, m)
    const prefix: string = this.root.endsWith("/") ? this.root : this.root + "/"
    const real: string | null = realpathSync(base)
    if (real === null) {
      return STATIC_NOT_FOUND
    }
    if (!real.startsWith(prefix)) {
      this.refused = true
      return STATIC_NOT_FOUND
    }
    // Each time is read before its file is opened: a file renamed over it in
    // between is then served once under the older time, and the next request
    // sees the newer one and reads it again, never the reverse.
    let mtime: f64 = statMtimeSync(real)
    let fd: i32 = fileOpen(real)
    if (fd < 0) {
      return STATIC_NOT_FOUND
    }
    this.coding = STATIC_IDENTITY
    if (this.limits.precompressed && this.acceptStart >= 0) {
      this.staticAccept(head)
      const brFirst: boolean = this.qBr >= this.qGzip
      for (let pass: i32 = 0; pass < 2; pass++) {
        const coding: i32 = (pass === 0) === brFirst ? STATIC_BR : STATIC_GZIP
        const q: i32 = coding === STATIC_BR ? this.qBr : this.qGzip
        if (this.coding === STATIC_IDENTITY && q > 0 && q >= this.qIdentity) {
          const sibling: string | null = realpathSync(base + (coding === STATIC_BR ? ".br" : ".gz"))
          if (sibling !== null && sibling.startsWith(prefix)) {
            const otherTime: f64 = statMtimeSync(sibling)
            const other: i32 = fileOpen(sibling)
            if (other >= 0) {
              fileClose(fd)
              fd = other
              mtime = otherTime
              this.coding = coding
            }
          }
        }
      }
    }
    this.fd = fd
    this.size = fileSize(fd)
    // biome-ignore lint/suspicious/noSelfCompare: NaN is the only value that is not itself; Nish has no Number.isNaN
    this.mtime = mtime === mtime ? mtime : 0
    if (this.size < 0) {
      this.staticClose()
      return STATIC_NOT_FOUND
    }
    return 0
  }

  /**
   * Reads `Accept-Encoding` into `qBr`, `qGzip` and `qIdentity`: `x-gzip` is
   * `gzip`, `*` stands for a coding the field does not name, the file as it
   * is stays acceptable unless given q=0 but ranks below any coding offered
   * when the field does not name it, and a malformed element is skipped.
   * @internal Called by `staticResolve`.
   */
  staticAccept(head: u8[]): void {
    let br: i32 = -1
    let gzip: i32 = -1
    let identity: i32 = -1
    let star: i32 = -1
    let i: i32 = this.acceptStart
    const e: i32 = this.acceptEnd
    while (i < e) {
      let j: i32 = i
      while (j < e && head[j] !== 44) {
        j++
      }
      let a: i32 = i
      while (a < j && staticSpace(toI32(head[a]))) {
        a++
      }
      let b: i32 = a
      while (b < j && head[b] !== 59 && !staticSpace(toI32(head[b]))) {
        b++
      }
      let q: i32 = 1000
      let ok: boolean = b > a
      let c: i32 = b
      while (ok && c < j) {
        while (c < j && staticSpace(toI32(head[c]))) {
          c++
        }
        if (c === j) {
          break
        }
        if (head[c] !== 59) {
          ok = false
          break
        }
        c++
        while (c < j && staticSpace(toI32(head[c]))) {
          c++
        }
        const ps: i32 = c
        while (c < j && head[c] !== 59 && !staticSpace(toI32(head[c]))) {
          c++
        }
        if (c - ps >= 2 && staticLower(toI32(head[ps])) === 113 && head[ps + 1] === 61) {
          q = staticQ(head, ps + 2, c)
          ok = q >= 0
        }
      }
      if (ok) {
        if (staticIs(head, a, b, "br")) {
          br = q
        } else if (staticIs(head, a, b, "gzip") || staticIs(head, a, b, "x-gzip")) {
          gzip = q
        } else if (staticIs(head, a, b, "identity")) {
          identity = q
        } else if (b - a === 1 && head[a] === 42) {
          star = q
        }
      }
      i = j + 1
    }
    // A coding the header does not name takes `*`'s weight, else its default.
    const coded: i32 = star >= 0 ? star : 0
    const plain: i32 = star >= 0 ? star : 1
    this.qBr = br >= 0 ? br : coded
    this.qGzip = gzip >= 0 ? gzip : coded
    this.qIdentity = identity >= 0 ? identity : plain
  }

  /** The file's modification time in whole seconds, or -1 when it has none. @internal */
  staticSecond(): i64 {
    return this.mtime > 0 ? toI64(this.mtime / 1000) : -1
  }

  /** Writes the strong ETag into `etag`. @internal Called by `staticPlan`. */
  staticTag(): void {
    const out: u8[] = this.etag
    out[0] = 34
    let at: i32 = staticHex(out, 1, this.size)
    out[at] = 45
    at = staticHex(out, at + 1, this.mtime > 0 ? toI64(this.mtime * 1000) : 0)
    if (this.coding !== STATIC_IDENTITY) {
      out[at] = 45
      out[at + 1] = this.coding === STATIC_BR ? 98 : 103
      out[at + 2] = this.coding === STATIC_BR ? 114 : 122
      at += 3
    }
    out[at] = 34
    this.etagLength = at + 1
  }

  /** Whether `head[start .. end)` is the ETag, byte for byte. @internal */
  staticSameTag(head: u8[], start: i32, end: i32): boolean {
    if (end - start !== this.etagLength) {
      return false
    }
    for (let k: i32 = 0; k < this.etagLength; k++) {
      if (head[start + k] !== this.etag[k]) {
        return false
      }
    }
    return true
  }

  /** Whether `If-None-Match` is `*` or names the ETag, weakly compared. @internal Called by `staticPlan`. */
  staticNoneMatch(head: u8[]): boolean {
    let k: i32 = this.noneMatchStart
    const e: i32 = this.noneMatchEnd
    while (k < e) {
      const b: i32 = toI32(head[k])
      if (b === 42) {
        return true
      }
      if (b === 87 && k + 2 < e && head[k + 1] === 47 && head[k + 2] === 34) {
        k += 2
      } else if (b === 34) {
        let close: i32 = k + 1
        while (close < e && head[close] !== 34) {
          close++
        }
        if (close === e) {
          return false
        }
        if (this.staticSameTag(head, k, close + 1)) {
          return true
        }
        k = close + 1
      } else {
        k++
      }
    }
    return false
  }

  /** Whether `If-Range` is the strong ETag, or the Last-Modified date of a file unchanged for a second or more. @internal Called by `staticRange`. */
  staticIfRange(head: u8[]): boolean {
    let s: i32 = this.ifRangeStart
    let e: i32 = this.ifRangeEnd
    while (s < e && staticSpace(toI32(head[s]))) {
      s++
    }
    while (e > s && staticSpace(toI32(head[e - 1]))) {
      e--
    }
    if (s < e && head[s] === 34) {
      return this.staticSameTag(head, s, e)
    }
    const at: i64 = staticDate(head, s, e)
    const last: i64 = this.staticSecond()
    // A date validates only a strong Last-Modified, a second or more before
    // now (RFC 9110 §13.1.5): two versions within one second share the date.
    return at >= 0 && at === last && (last + 1) * 1000 <= toI64(Date.now())
  }

  /**
   * Reads `Range`: 200 to send the whole file (another unit, more than one
   * range, or an `If-Range` that does not match), 206 with `from` and `to`
   * set, or 416 for a malformed or unsatisfiable range.
   * @internal Called by `staticPlan`.
   */
  staticRange(head: u8[]): i32 {
    let s: i32 = this.rangeStart
    let e: i32 = this.rangeEnd
    while (s < e && staticSpace(toI32(head[s]))) {
      s++
    }
    while (e > s && staticSpace(toI32(head[e - 1]))) {
      e--
    }
    if (e - s < 6 || !staticIs(head, s, s + 6, "bytes=")) {
      return 200
    }
    if (this.ifRangeStart >= 0 && !this.staticIfRange(head)) {
      return 200
    }
    let k: i32 = s + 6
    while (k < e && staticSpace(toI32(head[k]))) {
      k++
    }
    let dash: i32 = -1
    for (let x: i32 = k; x < e; x++) {
      if (head[x] === 44) {
        return 200
      }
      if (head[x] === 45 && dash < 0) {
        dash = x
      }
    }
    if (dash < 0 || this.size === 0) {
      return 416
    }
    const first: i64 = dash > k ? staticNumber(head, k, dash) : -2
    const last: i64 = dash + 1 < e ? staticNumber(head, dash + 1, e) : -2
    if (first === -1 || last === -1) {
      return 416
    }
    if (first === -2) {
      if (last <= 0) {
        return 416
      }
      this.from = this.size > last ? this.size - last : 0
      this.to = this.size
      return 206
    }
    if ((last !== -2 && last < first) || first >= this.size) {
      return 416
    }
    this.from = first
    this.to = last === -2 || last >= this.size ? this.size : last + 1
    return 206
  }

  /**
   * Finds the file's slot, or reads it into one when it is missing or its
   * time or size moved; leaves `slot` at -1 for a file too big to keep or
   * one that changed while it was read, which is then streamed from `fd`.
   * @internal Called by `staticPlan`.
   */
  staticLoad(): void {
    if (this.size > toI64(this.limits.maxCachedBytes)) {
      return
    }
    const stride: i32 = this.path.length
    const m: i32 = this.pathLength
    let hit: i32 = -1
    for (let k: i32 = 0; k < this.limits.maxEntries && hit < 0; k++) {
      if (this.keyLength[k] === m && this.keyCoding[k] === this.coding) {
        let same: boolean = true
        for (let x: i32 = 0; x < m && same; x++) {
          same = this.keys[k * stride + x] === this.path[x]
        }
        if (same) {
          hit = k
        }
      }
    }
    if (hit >= 0 && this.sizes[hit] === this.size && this.mtimes[hit] === this.mtime) {
      this.slot = hit
      return
    }
    let k: i32 = hit
    if (k < 0) {
      k = this.hand
      this.hand = (this.hand + 1) % this.limits.maxEntries
    }
    this.keyLength[k] = -1
    const size: i32 = toI32(this.size)
    if (this.bytes[k].length < size) {
      let cap: i32 = 64
      while (cap < size) {
        cap = 2 * cap
      }
      this.bytes[k] = new Array<u8>(cap)
    }
    const into: u8[] = this.bytes[k]
    let got: i32 = 0
    while (got < size) {
      const n: i32 = fileReadAt(this.fd, into, got, size - got, toI64(got))
      if (n <= 0) {
        return
      }
      got += n
    }
    copyBytes(this.keys, k * stride, this.path, 0, m)
    this.keyLength[k] = m
    this.keyCoding[k] = this.coding
    this.sizes[k] = this.size
    this.mtimes[k] = this.mtime
    this.slot = k
  }

  /**
   * How many body bytes from `pos` are ready to write: the rest of the range
   * from a slot, or one chunk read from `fd` into `chunk`, its tail zeroed
   * when the file shrank since it was measured.
   * @internal Called by `serve` and `serveHandler`.
   */
  staticFill(pos: i64): i32 {
    const left: i64 = this.to - pos
    if (this.slot >= 0) {
      return toI32(left)
    }
    const n: i32 = left > toI64(STATIC_CHUNK) ? STATIC_CHUNK : toI32(left)
    const got: i32 = fileReadAt(this.fd, this.chunk, 0, n, pos)
    for (let k: i32 = got < 0 ? 0 : got; k < n; k++) {
      this.chunk[k] = 0
    }
    return n
  }

  /** Closes the file the plan opened, if any. @internal */
  staticClose(): void {
    if (this.fd >= 0) {
      fileClose(this.fd)
      this.fd = -1
    }
  }

  /** The body length the head declares for `status`. @internal */
  staticBodyLength(status: i32): i64 {
    return status === 200 || status === 206 ? this.to - this.from : 0
  }

  /**
   * Pushes the response fields for `status` onto `names` and `values`, all
   * made fresh: the caller holds them in an arena block.
   * @internal Called by `serve` and `serveHandler`.
   */
  staticFields(status: i32, names: u8[][], values: u8[][]): void {
    if (status === 405) {
      names.push(httpFieldBytes("allow"))
      values.push(httpFieldBytes("GET, HEAD"))
      return
    }
    const scratch: u8[] = new Array<u8>(64)
    if (status === 416) {
      const at: i32 = staticDecimal(scratch, 8, this.size)
      copyBytes(scratch, 0, httpFieldBytes("bytes */"), 0, 8)
      names.push(httpFieldBytes("content-range"))
      values.push(staticCut(scratch, at))
      return
    }
    if (status !== 304) {
      names.push(httpFieldBytes("content-type"))
      values.push(httpFieldBytes(staticContentType(String.fromBytes(this.path, 0, this.pathLength))))
    }
    names.push(httpFieldBytes("etag"))
    values.push(staticCut(this.etag, this.etagLength))
    const date: u8[] = new Array<u8>(HTTP_DATE_SIZE)
    if (httpDateWrite(date, 0, this.staticSecond()) > 0) {
      names.push(httpFieldBytes("last-modified"))
      values.push(date)
    }
    if (this.limits.precompressed) {
      names.push(httpFieldBytes("vary"))
      values.push(httpFieldBytes("accept-encoding"))
    }
    if (status === 304) {
      return
    }
    names.push(httpFieldBytes("accept-ranges"))
    values.push(httpFieldBytes("bytes"))
    names.push(httpFieldBytes("x-content-type-options"))
    values.push(httpFieldBytes("nosniff"))
    if (this.coding !== STATIC_IDENTITY) {
      names.push(httpFieldBytes("content-encoding"))
      values.push(httpFieldBytes(this.coding === STATIC_BR ? "br" : "gzip"))
    }
    if (status === 206) {
      const prefix: string = "bytes "
      for (let k: i32 = 0; k < prefix.length; k++) {
        scratch[k] = toU8(prefix.charCodeAt(k))
      }
      let at: i32 = staticDecimal(scratch, prefix.length, this.from)
      scratch[at] = 45
      at = staticDecimal(scratch, at + 1, this.to - 1)
      scratch[at] = 47
      at = staticDecimal(scratch, at + 1, this.size)
      names.push(httpFieldBytes("content-range"))
      values.push(staticCut(scratch, at))
    }
  }
}
