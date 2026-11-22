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
 * then the file as it is. With it on, every file it sends, and every 304,
 * says `Vary: Accept-Encoding`.
 *
 * **Validators and ranges.** The ETag is strong, `"<size>-<mtime µs>"` in
 * hex, with `-br` or `-gz` for a coded variant. `If-None-Match` (weak
 * comparison, or `*`) answers 304; without it, an `If-Modified-Since` in the
 * IMF-fixdate form at or after the file's second answers 304, and another
 * date form is ignored. One `bytes=` range answers 206 with its
 * `Content-Range`; more than one sends the whole file; a malformed or
 * unsatisfiable one answers 416. `If-Range` keeps the range only for an
 * equal strong ETag, or the exact Last-Modified date of a file unchanged
 * for a second or more. A range on a coded variant counts the coded bytes.
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
 * `a + b` worked in 64 bits and narrowed: the offsets and counts added here
 * are spans of a request head, a path or a file under 2^31, so the sum
 * fits; one that does not wraps to a value the caller's range test refuses.
 */
const staticAdd = (a: i32, b: i32): i32 => toI32(toI64(a) + toI64(b))

/** `a - b` worked in 64 bits and narrowed, for the same offsets as `staticAdd`. */
const staticSub = (a: i32, b: i32): i32 => toI32(toI64(a) - toI64(b))

/**
 * Field `i`'s value start (`start`) or end in `r.head`, -1 for an absent field
 * (`i` below 0), or the handler's `Err` for an index it gives no span for.
 */
const staticValue = (r: HttpRequest, i: i32, start: boolean): Result<i32, string> => {
  if (i < 0) {
    return Ok(-1)
  }
  return start ? r.tryValueStart(i) : r.tryValueEnd(i)
}

/**
 * `b[i]`, or -1 when `i` is outside `b`. Every caller compares the answer
 * with a byte (a digit range, `,`, `.`, `/`, `"`, `=`, a space or an ETag
 * byte), which -1 never is, so a read past the end fails its parse as the
 * end of the input does.
 */
const staticByte = (b: u8[], i: i32): i32 => (i >= 0 && i < toI32(b.length) ? toI32(b[i]) : -1)

/**
 * `a + b` for file offsets and sizes, worked in `u64`, whose wrapping sum
 * has the bits of the signed one: they are below 2^31, so it never wraps.
 */
const staticAdd64 = (a: i64, b: i64): i64 => toI64(toU64(a) + toU64(b))

/** `a - b` for the same offsets as `staticAdd64`, the same way. */
const staticSub64 = (a: i64, b: i64): i64 => toI64(toU64(a) - toU64(b))

/**
 * Writes `v` to `out[i]` and answers `i + 1`, the next write's index; -1,
 * writing nothing, when `i` is outside `out`, so a chain of writes carries
 * the -1 to its end, where every caller checks it.
 */
const staticPut = (out: u8[], i: i32, v: i32): i32 => {
  if (i < 0 || i >= toI32(out.length)) {
    return -1
  }
  out[i] = toU8(v)
  return i + 1
}

/**
 * `n` zeroed bytes, `n` at most 2^30: one `new Array` up to 65535, which a
 * `u16` length proves, and pushes past it.
 */
const staticBytes = (n: i32): u8[] => {
  if (n <= 65535) {
    let size: i32 = 0
    if (n > 0) {
      size = n
    }
    return new Array<u8>(toU16(size))
  }
  const out: u8[] = new Array<u8>(65535)
  for (let i: i32 = 65535; i < n; i++) {
    out.push(0)
  }
  return out
}

/** The power of two from 64 up that holds `size`, at most 2^30. */
const staticCap = (size: i32): i32 => {
  let cap: i32 = 64
  while (cap < size && cap < 1073741824) {
    cap = staticAdd(cap, cap)
  }
  return cap
}

/** Reads `size` bytes of `fd` from its start into `into`: false when a read fails or `into` is short. */
const staticReadAll = (fd: i32, into: u8[], size: i32): boolean => {
  if (size > toI32(into.length)) {
    return false
  }
  let got: i32 = 0
  while (got < size) {
    const n: i32 = fileReadAt(fd, into, got, staticSub(size, got), toI64(got))
    if (n <= 0) {
      return false
    }
    got = staticAdd(got, n)
  }
  return true
}

/** The code unit of `s` at `i`, or -1 when `i` is outside `s`. */
const staticChar = (s: string, i: i32): i32 => (i >= 0 && i < toI32(s.length) ? toI32(s.charCodeAt(i)) : -1)

/**
 * The content type `serve` sends for a file name, by its extension (ASCII
 * case is ignored); `application/octet-stream` for one the table lacks.
 * @param name the file name, or a path ending in it
 * @returns the `Content-Type` value
 */
export const staticContentType = (name: string): string => {
  let dot: i32 = -1
  for (let k: i32 = toI32(name.length) - 1; k >= 0 && dot < 0; k--) {
    const c: i32 = toI32(name.charCodeAt(k))
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
  const length: i32 = toI32(name.length) - dot - 1
  let at: i32 = 0
  while (at < toI32(STATIC_TYPES.length)) {
    let k: i32 = 0
    // The name is shorter than the table, so `k` stays far below 2^31.
    while (
      k < length &&
      k < 65536 &&
      staticChar(STATIC_TYPES, staticAdd(at, k)) ===
        staticLower(staticChar(name, staticAdd(dot, staticAdd(1, k))))
    ) {
      k++
    }
    const space: i32 = toI32(STATIC_TYPES.indexOf(" ", at))
    const bar: i32 = toI32(STATIC_TYPES.indexOf("|", space))
    if (space < 0 || bar < 0) {
      break
    }
    if (k === length && space === staticAdd(at, length)) {
      return STATIC_TYPES.substring(staticAdd(space, 1), bar)
    }
    at = staticAdd(bar, 1)
  }
  return "application/octet-stream"
}

/** Whether `bytes[start .. end)` is `text`, ASCII case ignored. */
const staticIs = (bytes: u8[], start: i32, end: i32, text: string): boolean => {
  const size: i32 = toI32(text.length)
  if (staticSub(end, start) !== size) {
    return false
  }
  for (let k: i32 = 0; k < size; k++) {
    const b: i32 = staticByte(bytes, staticAdd(start, k))
    if (b < 0 || staticLower(b) !== staticLower(toI32(text.charCodeAt(k)))) {
      return false
    }
  }
  return true
}

/** Whether `b` is a space or a tab. */
const staticSpace = (b: i32): boolean => b === 32 || b === 9

/**
 * Writes `v` (0 or more) in base `radix` (10 or 16, lowercase) at
 * `out[at ..)` and answers the index past it; -1, writing nothing, when `at`
 * is -1 or the digits do not fit, which every caller checks. Every `v` a
 * caller passes is 0 or more (a size `staticResolve` refused below 0, a
 * range inside it, an mtime clamped at 0), so each remainder is a digit and
 * the guard in the loop never skips a byte.
 */
const staticDigits = (out: u8[], at: i32, v: i64, radix: i64): i32 => {
  // Any radix but 16 is 10.
  const hex: boolean = radix === 16
  let digits: i32 = 1
  let rest: i64 = hex ? v / 16 : v / 10
  // An i64 has at most 20 digits in base 10.
  while (rest > 0 && digits < 32) {
    digits++
    rest = hex ? rest / 16 : rest / 10
  }
  if (at < 0 || staticAdd(at, digits) > toI32(out.length)) {
    return -1
  }
  let x: i64 = v
  for (let k: i32 = digits - 1; k >= 0; k--) {
    const d: i32 = toI32(hex ? x % 16 : x % 10)
    // The test above keeps `i` inside `out`, and a remainder is a digit;
    // this repeats it where the prover reads it.
    const i: i32 = staticAdd(at, k)
    if (i >= 0 && i < toI32(out.length) && d >= 0 && d < 16) {
      out[i] = toU8(d < 10 ? 48 + d : 87 + d)
    }
    x = hex ? x / 16 : x / 10
  }
  return staticAdd(at, digits)
}

/** The two digits at `b[at ..)` as a number, or -1. */
const staticTwo = (b: u8[], at: i32): i32 => {
  const hi: i32 = staticByte(b, at)
  const lo: i32 = staticByte(b, staticAdd(at, 1))
  if (hi < 48 || hi > 57 || lo < 48 || lo > 57) {
    return -1
  }
  const ten: i32 = 10
  return ten * (hi - 48) + (lo - 48)
}

/** The month names, three letters each from January. */
const STATIC_MONTHS: string = "JanFebMarAprMayJunJulAugSepOctNovDec"

/**
 * The IMF-fixdate at `b[start .. end)` (`Sun, 06 Nov 1994 08:49:37 GMT`) as
 * seconds since 1970, or -1 for anything else: the obsolete RFC 850 and
 * asctime forms are not read.
 */
const staticDate = (b: u8[], start: i32, end: i32): i64 => {
  if (
    start < 0 ||
    end > toI32(b.length) ||
    staticSub(end, start) !== HTTP_DATE_SIZE ||
    staticByte(b, staticAdd(start, 3)) !== 44 ||
    staticByte(b, staticAdd(start, 4)) !== 32
  ) {
    return -1
  }
  const at: i32 = staticAdd(start, 5)
  const m0: i32 = staticByte(b, staticAdd(at, 3))
  const m1: i32 = staticByte(b, staticAdd(at, 4))
  const m2: i32 = staticByte(b, staticAdd(at, 5))
  const day: i32 = staticTwo(b, at)
  let month: i32 = -1
  for (let m: i32 = 0; m < 12; m++) {
    if (
      m0 === staticChar(STATIC_MONTHS, 3 * m) &&
      m1 === staticChar(STATIC_MONTHS, 3 * m + 1) &&
      m2 === staticChar(STATIC_MONTHS, 3 * m + 2)
    ) {
      month = m + 1
    }
  }
  const century: i32 = staticTwo(b, staticAdd(at, 7))
  const years: i32 = staticTwo(b, staticAdd(at, 9))
  const hour: i32 = staticTwo(b, staticAdd(at, 12))
  const minute: i32 = staticTwo(b, staticAdd(at, 15))
  const second: i32 = staticTwo(b, staticAdd(at, 18))
  if (
    day < 1 ||
    day > 31 ||
    month < 0 ||
    month > 12 ||
    century < 0 ||
    century > 99 ||
    years < 0 ||
    years > 99 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 60 ||
    !staticIs(b, staticAdd(at, 20), staticAdd(at, 24), " GMT") ||
    staticByte(b, staticAdd(at, 2)) !== 32 ||
    staticByte(b, staticAdd(at, 6)) !== 32 ||
    staticByte(b, staticAdd(at, 11)) !== 32 ||
    staticByte(b, staticAdd(at, 14)) !== 58 ||
    staticByte(b, staticAdd(at, 17)) !== 58
  ) {
    return -1
  }
  // The bounds again, alone, where the prover reads them for the sums below.
  if (century < 0 || century > 99) {
    return -1
  }
  if (years < 0 || years > 99) {
    return -1
  }
  if (month < 1 || month > 12) {
    return -1
  }
  if (day < 1 || day > 31) {
    return -1
  }
  if (hour < 0 || hour > 23) {
    return -1
  }
  if (minute < 0 || minute > 59) {
    return -1
  }
  if (second < 0 || second > 60) {
    return -1
  }
  // Days from 1970-01-01 to the civil date (Howard Hinnant's days_from_civil),
  // with the year starting in March. For a year of 0 or more, the eras of
  // 400 years add up to the leap days counted below, and so does 0000's
  // January, the one year of -1; every term is small enough for an `i32`.
  let year: i32 = 100 * century + years
  let mp: i32 = month + 9
  if (month > 2) {
    mp = month - 3
  } else {
    year = year - 1
  }
  // The prover does not carry `year` through the branches, so `365 * year`
  // is worked in `u64`, whose wrapping keeps the signed bits.
  const y: i32 = year
  const dayOfYear: i32 = (153 * mp + 2) / 5 + day - 1
  const leaps: i32 = staticAdd(staticSub(y / 4, y / 100), y / 400)
  const days: i32 = staticSub(
    staticAdd(staticAdd(toI32(toI64(toU64(y) * toU64(365))), leaps), dayOfYear),
    719468
  )
  // Worked in `u64`, whose wrapping has the bits of the signed result: `days`
  // is within 2^22 of 0, so the seconds never wrap.
  return toI64(toU64(days) * toU64(86400) + toU64(3600 * hour + 60 * minute + second))
}

/**
 * The decimal digits at `b[start .. end)` as a number, or -1 for none, a
 * byte that is not a digit, or more than 18 digits.
 */
const staticNumber = (b: u8[], start: i32, end: i32): i64 => {
  if (start < 0 || end <= start || staticSub(end, start) > 18) {
    return -1
  }
  let n: i64 = 0
  for (let k: i32 = start; k < end && k < toI32(b.length); k++) {
    const d: i32 = toI32(b[k]) - 48
    if (d < 0 || d > 9) {
      return -1
    }
    // Worked in `u64`, whose wrapping result has the bits of the signed
    // one: eighteen digits are below 10^18, so it never wraps.
    n = toI64(toU64(n) * toU64(10) + toU64(d))
  }
  return n
}

/**
 * The q-value at `b[start .. end)` in thousandths (`0`, `1`, `0.5`,
 * `1.000`), or -1 when it is not one.
 */
const staticQ = (b: u8[], start: i32, end: i32): i32 => {
  if (end <= start || staticSub(end, start) > 5) {
    return -1
  }
  const first: i32 = staticByte(b, start)
  if (first < 48 || first > 49) {
    return -1
  }
  const whole: i32 = first - 48
  if (staticSub(end, start) === 1) {
    return 1000 * whole
  }
  if (staticByte(b, staticAdd(start, 1)) !== 46) {
    return -1
  }
  let q: i32 = 1000 * whole
  let scale: i32 = 100
  for (let k: i32 = staticAdd(start, 2); k >= 0 && k < end && k < toI32(b.length); k++) {
    const d: i32 = toI32(b[k]) - 48
    // Three digits at most, so `q` stays under 2000 and `scale` at most 100.
    if (d < 0 || d > 9 || q < 0 || q > 2000 || scale < 0 || scale > 100) {
      return -1
    }
    q += scale * d
    scale = scale / 10
  }
  return q > 1000 ? -1 : q
}

/** A new array of `src[0 .. length)`. */
const staticCut = (src: u8[], length: i32): u8[] => {
  const out: u8[] = []
  for (let k: i32 = 0; k < length && k < toI32(src.length); k++) {
    out.push(src[k])
  }
  return out
}

/** Serves the files under one directory; one per server, not reentrant. */
export class StaticFiles {
  /** The root's real path, or `""` when it did not resolve (then every request is not found). */
  root: string
  /** `root` with one trailing `/`: a resolved path under it starts with this. @internal */
  under: string
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
  /** How many bytes of `etag` are the ETag; beside `pathLength`, so the two share one 8-byte slot. @internal */
  etagLength: i32 = 0
  /** The ETag the plan made, `etag[0 .. etagLength)`. @internal */
  etag: u8[]
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

  /** The cache keys, one of `path.length` bytes per entry. @internal */
  keys: u8[][]
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
    this.under = this.root.endsWith("/") ? this.root : this.root + "/"
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
    // Literal bounds, so the prover sees that the sum cannot overflow and that
    // each length below fits the `u16` an array length is proven by.
    if (ok && asked <= 4096 && longest <= 4096 && asked >= 1 && longest >= 1) {
      entries = asked
      room = longest + 16
    }
    own.maxEntries = entries
    own.maxPath = room - 16
    const width: u16 = toU16(room)
    const count: u16 = toU16(entries)
    this.path = new Array<u8>(width)
    this.etag = new Array<u8>(48)
    this.chunk = new Array<u8>(STATIC_CHUNK)
    this.keyCoding = new Array<i32>(count)
    this.sizes = new Array<i64>(count)
    this.mtimes = new Array<f64>(count)
    const lengths: i32[] = []
    const keys: u8[][] = []
    const slots: u8[][] = []
    for (let k: i32 = 0; k < entries; k++) {
      lengths.push(-1)
      keys.push(new Array<u8>(width))
      slots.push(new Array<u8>(0))
    }
    this.keyLength = lengths
    this.keys = keys
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
        // `staticLoad` made `slot` an index of `bytes`, or -1.
        const slot: i32 = this.slot
        sent = server.write(
          r,
          slot >= 0 && slot < toI32(this.bytes.length) ? this.bytes[slot] : this.chunk,
          slot >= 0 ? toI32(pos) : toI32(0),
          n
        )
        pos = staticAdd64(pos, toI64(n))
      }
    }
    this.staticClose()
    return sent === HANDLER_SENT ? server.end(r) : sent
  }

  /**
   * `serve` through `nish/net/handler`'s HTTP/1.1 carrier. Panics where
   * `HttpHandler.start`, `write` or `end` would, and on a field index the
   * handler gives no value span for; `tryServeHandler` answers each as an
   * `Err` instead.
   * @param h the handler `r` came from
   * @param r a request taken and not yet answered
   * @param pathStart where the path starts in `r.head`
   * @param pathEnd one past its last byte
   * @returns `HANDLER_SENT`, `HANDLER_DROPPED`, or `STATIC_NOT_FOUND` with nothing sent
   */
  serveHandler(h: HttpHandler, r: HttpRequest, pathStart: i32, pathEnd: i32): i32 {
    const head: boolean = r.methodIs("HEAD")
    const planned = this.staticRequest(r, pathStart, pathEnd)
    if (planned.isErr()) {
      // `HttpRequest.valueStart`'s contract, as this read it before: an index
      // `header` answered always has a span, so this is the handler's fault.
      // `tryServeHandler` answers it as an `Err` instead.
      panic(planned.error)
    }
    const status: i32 = planned.value
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
        // `staticLoad` made `slot` an index of `bytes`, or -1.
        const slot: i32 = this.slot
        sent = h.write(
          r,
          slot >= 0 && slot < toI32(this.bytes.length) ? this.bytes[slot] : this.chunk,
          slot >= 0 ? toI32(pos) : toI32(0),
          n
        )
        pos = staticAdd64(pos, toI64(n))
      }
    }
    this.staticClose()
    // `end` also after `HANDLER_DROPPED`: it is what hands `r` back.
    return h.end(r)
  }

  /**
   * `serveHandler` through the handler's `try` calls: a misuse that makes
   * `start`, `write` or `end` panic comes back as the handler's reason
   * instead, with the file closed; so does a field index the handler gives
   * no value span for, before anything is sent. An `Err` from before the
   * head (that field index, a request not taken) leaves `r` owed an answer;
   * one from after it (`tryWrite` or `tryEnd` refusing the body) has closed
   * the connection and handed `r` back, as `HttpHandler` describes.
   * @param h the handler `r` came from
   * @param r a request taken and not yet answered
   * @param pathStart where the path starts in `r.head`
   * @param pathEnd one past its last byte
   * @returns Ok of what `serveHandler` answers, or Err of the handler's reason
   */
  tryServeHandler(h: HttpHandler, r: HttpRequest, pathStart: i32, pathEnd: i32): Result<i32, string> {
    const head: boolean = r.methodIs("HEAD")
    const status: i32 = this.staticRequest(r, pathStart, pathEnd).orReturn()
    if (status === STATIC_NOT_FOUND) {
      return Ok(STATIC_NOT_FOUND)
    }
    const names: u8[][] = []
    const values: u8[][] = []
    this.staticFields(status, names, values)
    const started: Result<i32, string> = h.tryStart(
      r,
      status,
      names,
      values,
      toI32(this.staticBodyLength(status))
    )
    if (started.isErr()) {
      this.staticClose()
      return Err(started.error)
    }
    let sent: i32 = started.value
    if (sent === HANDLER_SENT && !head && this.staticBodyLength(status) > 0) {
      let pos: i64 = this.from
      while (sent === HANDLER_SENT && pos < this.to) {
        const n: i32 = this.staticFill(pos)
        // `staticLoad` made `slot` an index of `bytes`, or -1.
        const slot: i32 = this.slot
        const wrote: Result<i32, string> = h.tryWrite(
          r,
          slot >= 0 && slot < toI32(this.bytes.length) ? this.bytes[slot] : this.chunk,
          slot >= 0 ? toI32(pos) : toI32(0),
          n
        )
        if (wrote.isErr()) {
          this.staticClose()
          return Err(wrote.error)
        }
        sent = wrote.value
        pos = staticAdd64(pos, toI64(n))
      }
    }
    this.staticClose()
    // `tryEnd` also after `HANDLER_DROPPED`: it is what hands `r` back, and
    // for a dropped request it answers `Ok(HANDLER_DROPPED)`.
    const ended: Result<i32, string> = h.tryEnd(r)
    if (ended.isErr()) {
      return Err(ended.error)
    }
    return Ok(ended.value)
  }

  /**
   * Reads the request's conditional, range and coding headers and plans the
   * answer: its status, or `STATIC_NOT_FOUND`; `Err` when the handler gives
   * no value span for a field index its `header` answered.
   * @internal Called by `serveHandler` and `tryServeHandler`.
   */
  staticRequest(r: HttpRequest, pathStart: i32, pathEnd: i32): Result<i32, string> {
    const ae: i32 = r.header("accept-encoding")
    this.acceptStart = staticValue(r, ae, true).orReturn()
    this.acceptEnd = staticValue(r, ae, false).orReturn()
    const nm: i32 = r.header("if-none-match")
    this.noneMatchStart = staticValue(r, nm, true).orReturn()
    this.noneMatchEnd = staticValue(r, nm, false).orReturn()
    const ims: i32 = r.header("if-modified-since")
    this.sinceStart = staticValue(r, ims, true).orReturn()
    this.sinceEnd = staticValue(r, ims, false).orReturn()
    const rg: i32 = r.header("range")
    this.rangeStart = staticValue(r, rg, true).orReturn()
    this.rangeEnd = staticValue(r, rg, false).orReturn()
    const ir: i32 = r.header("if-range")
    this.ifRangeStart = staticValue(r, ir, true).orReturn()
    this.ifRangeEnd = staticValue(r, ir, false).orReturn()
    const head: boolean = r.methodIs("HEAD")
    return Ok(this.staticPlan(r.head, pathStart, pathEnd, head || r.methodIs("GET"), head))
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
    const length: i32 = staticSub(pathEnd, pathStart)
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
    // `path` has 16 bytes of room past `maxPath`, so the decoded name and an
    // appended `index.html` fit; each loop is still bounded by `room`, the
    // guard the prover reads.
    const room: i32 = toI32(path.length)
    let m: i32 = decoded
    if (decoded > 0 && staticByte(path, 0) === 47) {
      m = decoded - 1
      for (let k: i32 = 1; k < decoded && k < room; k++) {
        path[k - 1] = path[k]
      }
    }
    if (m === 0 || staticByte(path, staticSub(m, 1)) === 47) {
      if (!this.limits.index) {
        return STATIC_NOT_FOUND
      }
      const index: string = "index.html"
      const size: i32 = toI32(index.length)
      for (let k: i32 = 0; k < size; k++) {
        if (staticPut(path, staticAdd(m, k), toI32(index.charCodeAt(k))) < 0) {
          this.refused = true
          return STATIC_NOT_FOUND
        }
      }
      m = staticAdd(m, size)
    }
    if (m > room) {
      this.refused = true
      return STATIC_NOT_FOUND
    }
    // Each segment is refused when it is empty or starts with `.`, which
    // `dot` holds from its first byte, and any byte below 32, 127 or `\`.
    let segment: i32 = 0
    let dot: boolean = false
    for (let k: i32 = 0; k < m && k < room; k++) {
      const b: i32 = toI32(path[k])
      if (b === 47) {
        if (k === segment || dot) {
          this.refused = true
          return STATIC_NOT_FOUND
        }
        segment = k + 1
        dot = false
      } else if (b < 32 || b === 127 || b === 92) {
        this.refused = true
        return STATIC_NOT_FOUND
      } else if (k === segment && b === 46) {
        dot = true
      }
    }
    if (m === segment || dot) {
      this.refused = true
      return STATIC_NOT_FOUND
    }
    if (m < 0 || m > toI32(path.length)) {
      this.refused = true
      return STATIC_NOT_FOUND
    }
    this.pathLength = m
    const base: string = this.under + String.fromBytes(path, 0, m)
    const real: string | null = realpathSync(base)
    if (real === null) {
      return STATIC_NOT_FOUND
    }
    if (!real.startsWith(this.under)) {
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
          if (sibling !== null && sibling.startsWith(this.under)) {
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
    // Each scan is bounded by `e` and by `n`, and starts at `i`, which is
    // never below 0 (an absent field is -1): the guards the prover reads for
    // every index below.
    const n: i32 = toI32(head.length)
    let i: i32 = this.acceptStart
    const e: i32 = this.acceptEnd
    while (i < e && i >= 0) {
      let j: i32 = i
      while (j < e && j < n && head[j] !== 44) {
        j++
      }
      let a: i32 = i
      while (a < j && a < n && staticSpace(toI32(head[a]))) {
        a++
      }
      let b: i32 = a
      while (b < j && b < n && head[b] !== 59 && !staticSpace(toI32(head[b]))) {
        b++
      }
      let q: i32 = 1000
      let ok: boolean = b > a
      let c: i32 = b
      while (ok && c < j) {
        while (c < j && c < n && staticSpace(toI32(head[c]))) {
          c++
        }
        if (c === j) {
          break
        }
        if (c >= n || head[c] !== 59) {
          ok = false
          break
        }
        c++
        while (c < j && c < n && staticSpace(toI32(head[c]))) {
          c++
        }
        const ps: i32 = c
        while (c < j && c < n && head[c] !== 59 && !staticSpace(toI32(head[c]))) {
          c++
        }
        if (
          staticSub(c, ps) >= 2 &&
          staticLower(staticByte(head, ps)) === 113 &&
          staticByte(head, staticAdd(ps, 1)) === 61
        ) {
          q = staticQ(head, staticAdd(ps, 2), c)
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
        } else if (staticSub(b, a) === 1 && staticByte(head, a) === 42) {
          star = q
        }
      }
      i = staticAdd(j, 1)
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
    // `etag` has 48 bytes, and the longest tag, two 16-digit numbers, three
    // quotes and dashes and a coding, is 38.
    // A write that does not fit answers -1 and every later one carries it:
    // the file then has no ETag (`etagLength` 0), sent or matched — which
    // RFC 9110 §8.8.3 allows, an ETag being optional; at 38 bytes of 48 it
    // does not happen.
    const out: u8[] = this.etag
    let at: i32 = staticPut(out, 0, 34)
    at = staticDigits(out, at, this.size, 16)
    at = staticPut(out, at, 45)
    at = staticDigits(out, at, this.mtime > 0 ? toI64(this.mtime * 1000) : 0, 16)
    if (this.coding !== STATIC_IDENTITY) {
      at = staticPut(out, at, 45)
      at = staticPut(out, at, this.coding === STATIC_BR ? 98 : 103)
      at = staticPut(out, at, this.coding === STATIC_BR ? 114 : 122)
    }
    at = staticPut(out, at, 34)
    this.etagLength = at < 0 ? 0 : at
  }

  /** Whether `head[start .. end)` is the ETag, byte for byte. @internal */
  staticSameTag(head: u8[], start: i32, end: i32): boolean {
    if (this.etagLength <= 0 || staticSub(end, start) !== this.etagLength) {
      return false
    }
    const etag: u8[] = this.etag
    for (let k: i32 = 0; k < this.etagLength; k++) {
      if (k >= toI32(etag.length) || staticByte(head, staticAdd(start, k)) !== toI32(etag[k])) {
        return false
      }
    }
    return true
  }

  /** Whether `If-None-Match` is `*` or names the ETag, weakly compared. @internal Called by `staticPlan`. */
  staticNoneMatch(head: u8[]): boolean {
    // Every index below is at least `k`, never below 0 (an absent field is
    // -1), and is tested against `n`: the guards the prover reads.
    const n: i32 = toI32(head.length)
    let k: i32 = this.noneMatchStart
    const e: i32 = this.noneMatchEnd
    while (k < e && k >= 0 && k < n) {
      const b: i32 = toI32(head[k])
      if (b === 42) {
        return true
      }
      if (
        b === 87 &&
        staticByte(head, staticAdd(k, 1)) === 47 &&
        staticByte(head, staticAdd(k, 2)) === 34 &&
        staticAdd(k, 2) < e
      ) {
        k = staticAdd(k, 2)
      } else if (b === 34) {
        let close: i32 = k + 1
        while (close < e && close < n && head[close] !== 34) {
          close++
        }
        if (close >= e || close >= n) {
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
    // `s` is never below 0 here (an absent field is -1) and each scan is
    // tested against `n`: the guards the prover reads.
    const n: i32 = toI32(head.length)
    while (s < e && s >= 0 && s < n && staticSpace(toI32(head[s]))) {
      s++
    }
    while (e > s && staticSpace(staticByte(head, staticSub(e, 1)))) {
      e = staticSub(e, 1)
    }
    if (s < e && staticByte(head, s) === 34) {
      return this.staticSameTag(head, s, e)
    }
    const at: i64 = staticDate(head, s, e)
    const last: i64 = this.staticSecond()
    // A date validates only a strong Last-Modified, a second or more before
    // now (RFC 9110 §13.1.5): two versions within one second share the date.
    // `last` is a time in seconds, far below 2^53, so the product never wraps.
    return at >= 0 && at === last && toI64((toU64(last) + toU64(1)) * toU64(1000)) <= toI64(Date.now())
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
    // `s` is never below 0 here (an absent field is -1) and each scan is
    // tested against `n`: the guards the prover reads.
    const n: i32 = toI32(head.length)
    while (s < e && s >= 0 && s < n && staticSpace(toI32(head[s]))) {
      s++
    }
    while (e > s && staticSpace(staticByte(head, staticSub(e, 1)))) {
      e = staticSub(e, 1)
    }
    if (staticSub(e, s) < 6 || !staticIs(head, s, staticAdd(s, 6), "bytes=")) {
      return 200
    }
    if (this.ifRangeStart >= 0 && !this.staticIfRange(head)) {
      return 200
    }
    let k: i32 = staticAdd(s, 6)
    while (k < e && k >= 0 && k < n && staticSpace(toI32(head[k]))) {
      k++
    }
    let dash: i32 = -1
    for (let x: i32 = k; x < e && x >= 0 && x < n; x++) {
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
    const last: i64 = staticAdd(dash, 1) < e ? staticNumber(head, staticAdd(dash, 1), e) : -2
    if (first === -1 || last === -1) {
      return 416
    }
    if (first === -2) {
      if (last <= 0) {
        return 416
      }
      this.from = this.size > last ? staticSub64(this.size, last) : 0
      this.to = this.size
      return 206
    }
    if ((last !== -2 && last < first) || first >= this.size) {
      return 416
    }
    this.from = first
    this.to = last === -2 || last >= this.size ? this.size : staticAdd64(last, 1)
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
    const m: i32 = this.pathLength
    const path: u8[] = this.path
    const keyLength: i32[] = this.keyLength
    const keyCoding: i32[] = this.keyCoding
    const keys: u8[][] = this.keys
    const entries: i32 = this.limits.maxEntries
    let hit: i32 = -1
    for (let k: i32 = 0; k < entries && hit < 0; k++) {
      if (k < toI32(keyLength.length) && k < toI32(keyCoding.length) && k < toI32(keys.length)) {
        if (keyLength[k] === m && keyCoding[k] === this.coding) {
          const key: u8[] = keys[k]
          let same: boolean = true
          for (let x: i32 = 0; x < m && same; x++) {
            same = x < toI32(key.length) && x < toI32(path.length) && key[x] === path[x]
          }
          if (same) {
            hit = k
          }
        }
      }
    }
    const sizes: i64[] = this.sizes
    const mtimes: f64[] = this.mtimes
    const bytes: u8[][] = this.bytes
    let k: i32 = hit
    if (k < 0) {
      k = this.hand
      const next: i32 = staticAdd(k, 1)
      this.hand = next < 0 || next >= entries ? 0 : next
    }
    // Every row has `maxEntries` entries and `hand` stays below it; an entry
    // outside them, which never happens, streams like a file too big to keep.
    if (
      k < 0 ||
      k >= toI32(keyLength.length) ||
      k >= toI32(keyCoding.length) ||
      k >= toI32(keys.length) ||
      k >= toI32(sizes.length) ||
      k >= toI32(mtimes.length) ||
      k >= toI32(bytes.length)
    ) {
      return
    }
    if (hit >= 0 && sizes[k] === this.size && mtimes[k] === this.mtime) {
      this.slot = k
      return
    }
    const at: i32 = k
    keyLength[at] = -1
    const size: i32 = toI32(this.size)
    let into: u8[] = bytes[at]
    if (toI32(into.length) < size) {
      into = staticBytes(staticCap(size))
      // A call may change any array's length, so the bound is read again.
      if (at >= toI32(bytes.length)) {
        return
      }
      bytes[at] = into
    }
    if (!staticReadAll(this.fd, into, size)) {
      return
    }
    if (
      at >= toI32(keyLength.length) ||
      at >= toI32(keyCoding.length) ||
      at >= toI32(keys.length) ||
      at >= toI32(sizes.length) ||
      at >= toI32(mtimes.length)
    ) {
      return
    }
    copyBytes(keys[at], 0, path, 0, m)
    keyLength[at] = m
    keyCoding[at] = this.coding
    sizes[at] = this.size
    mtimes[at] = this.mtime
    this.slot = at
  }

  /**
   * How many body bytes from `pos` are ready to write: the rest of the range
   * from a slot, or one chunk read from `fd` into `chunk`, its tail zeroed
   * when the file shrank since it was measured.
   * @internal Called by `serve` and `serveHandler`.
   */
  staticFill(pos: i64): i32 {
    const left: i64 = staticSub64(this.to, pos)
    if (this.slot >= 0) {
      return toI32(left)
    }
    const n: i32 = left > toI64(STATIC_CHUNK) ? STATIC_CHUNK : toI32(left)
    const got: i32 = fileReadAt(this.fd, this.chunk, 0, n, pos)
    const chunk: u8[] = this.chunk
    for (let k: i32 = 0; k < n && k < toI32(chunk.length); k++) {
      if (k >= got) {
        chunk[k] = 0
      }
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
    return status === 200 || status === 206 ? staticSub64(this.to, this.from) : 0
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
      // A size below 2^31 (`STATIC_MAX_FILE`) has 10 digits, which
      // `scratch` holds; -1 would send the 416 without the field, which
      // RFC 9110 §15.5.17 only recommends.
      const at: i32 = staticDigits(scratch, 8, this.size, 10)
      copyBytes(scratch, 0, httpFieldBytes("bytes */"), 0, 8)
      if (at >= 0) {
        names.push(httpFieldBytes("content-range"))
        values.push(staticCut(scratch, at))
      }
      return
    }
    if (status !== 304) {
      names.push(httpFieldBytes("content-type"))
      values.push(httpFieldBytes(staticContentType(String.fromBytes(this.path, 0, this.pathLength))))
    }
    if (this.etagLength > 0) {
      names.push(httpFieldBytes("etag"))
      values.push(staticCut(this.etag, this.etagLength))
    }
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
      copyBytes(scratch, 0, httpFieldBytes("bytes "), 0, 6)
      // Three numbers below 2^31 (`STATIC_MAX_FILE`) and the words around
      // them, 38 bytes at most, fit `scratch`'s 64, so the field is never
      // dropped: a 206 without it would break RFC 9110 §15.3.7.
      let at: i32 = staticDigits(scratch, 6, this.from, 10)
      at = staticPut(scratch, at, 45)
      at = staticDigits(scratch, at, staticSub64(this.to, 1), 10)
      at = staticPut(scratch, at, 47)
      at = staticDigits(scratch, at, this.size, 10)
      if (at >= 0) {
        names.push(httpFieldBytes("content-range"))
        values.push(staticCut(scratch, at))
      }
    }
  }
}
