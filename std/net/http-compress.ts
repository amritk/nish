/**
 * `nish/net/http-compress` — content coding for HTTP responses (RFC 9110
 * §8.4 and §12.5.3): reading a request's `Accept-Encoding` and compressing a
 * body with `Content-Encoding: gzip`, for any of the three servers.
 *
 *     import { DEFLATE_FAST } from "nish/compress/deflate";
 *     import { HTTP_CODING_GZIP, HttpCompressor } from "nish/net/http-compress";
 *
 *     const enc = new HttpCompressor(DEFLATE_FAST, 1024, 65536); // once per thread
 *     // HTTP/1.1, in one call:
 *     conn.respondEncoded(200, names, values, body, 0, n, enc, conn.acceptEncoding());
 *     // HTTP/2 or HTTP/3, by hand:
 *     const coding: i32 = httpAcceptEncoding(value, 0, toI32(value.length), HTTP_OFFER_GZIP);
 *     const m: i32 = enc.compress(coding, body, 0, n);
 *     if (m >= 0) {
 *       enc.addFields(names, values);
 *       h2.respond(id, 200, enc.names, enc.values, false);
 *       h2.write(id, enc.output, 0, m);
 *     }
 *
 * **Opt-in.** Nothing here runs unless the program asks: it decides which
 * responses to compress, and `HttpCompressor` declines any body shorter than
 * its `minLength`, longer than its `maxLength`, or that gzip would not make
 * smaller, answering -1 so the program sends the bytes as they are.
 *
 * **Negotiation** (`httpAcceptEncoding`) follows §12.5.3: each listed coding
 * with its q-value, `x-gzip` as `gzip`, `*` for every coding not listed, and
 * `identity` acceptable unless it is given q=0, directly or through `*`. Of
 * the codings the program offers, the most preferred with q above 0 wins, the
 * program's order (gzip, then deflate) breaking ties; it beats `identity` at
 * an equal q, and beats an `identity` the field does not mention at any q. With no field at all the answer is
 * `HTTP_CODING_IDENTITY` (the RFC allows any coding then, but a client that
 * says nothing is safest sent nothing it may not read); an empty field asks
 * for identity too. `HTTP_CODING_NONE` means nothing offered is acceptable
 * and identity is refused: a server may answer 406 or send identity anyway.
 * A malformed element is skipped. The parser allocates nothing.
 *
 * **Compressing allocates nothing**: `HttpCompressor` holds a
 * `GzipCompressor`, an output buffer of `compressBound(maxLength)` bytes and
 * the field arrays `addFields` fills, all built once.
 * `HTTP_CODING_DEFLATE` (zlib framing) is negotiated but not produced: a
 * client that accepts only `deflate` is sent identity, which every client
 * reads.
 */
import { DEFLATE_FAST, compressBound } from "nish/compress/deflate"
import { GzipCompressor } from "nish/compress/gzip"

/** No content coding: the body as it is. */
export const HTTP_CODING_IDENTITY: i32 = 0

/** `gzip` (RFC 9110 §8.4.1.3), or its alias `x-gzip`. */
export const HTTP_CODING_GZIP: i32 = 1

/** `deflate`: the zlib format (RFC 9110 §8.4.1.2). */
export const HTTP_CODING_DEFLATE: i32 = 2

/** Nothing offered is acceptable, identity included (§12.5.3: 406, or identity anyway). */
export const HTTP_CODING_NONE: i32 = -1

/** `httpAcceptEncoding`'s `offered` bits: the program can send gzip, deflate. */
export const HTTP_OFFER_GZIP: i32 = 1
export const HTTP_OFFER_DEFLATE: i32 = 2

/** A q-value of 1, in thousandths. */
const HTTP_Q_ONE: i32 = 1000

/** Whether `c` is an ASCII letter, digit or one of the token characters a coding uses. */
const httpCodingChar = (c: i32): boolean =>
  (c >= 97 && c <= 122) ||
  (c >= 65 && c <= 90) ||
  (c >= 48 && c <= 57) ||
  c === 45 ||
  c === 46 ||
  c === 95 ||
  c === 42 ||
  c === 33 ||
  c === 35 ||
  c === 36 ||
  c === 37 ||
  c === 38 ||
  c === 39 ||
  c === 43 ||
  c === 94 ||
  c === 96 ||
  c === 124 ||
  c === 126

/** Whether `buf[start .. end)` is `word`, ignoring ASCII case; `word` is lower case. */
const httpCodingIs = (buf: u8[], start: i32, end: i32, word: string): boolean => {
  if (end - start !== toI32(word.length)) {
    return false
  }
  for (let i: i32 = 0; i < end - start; i += 1) {
    let c: i32 = toI32(buf[start + i])
    if (c >= 65 && c <= 90) {
      c += 32
    }
    if (c !== word.charCodeAt(i)) {
      return false
    }
  }
  return true
}

/**
 * The q-value of `buf[start .. end)`, in thousandths (RFC 9110 §12.4.2:
 * `0`, `0.` and up to three digits, `1`, `1.` and up to three zeros), or -1
 * when it is not one.
 */
const httpQValue = (buf: u8[], start: i32, end: i32): i32 => {
  if (start >= end) {
    return -1
  }
  const lead: i32 = toI32(buf[start])
  if (lead !== 48 && lead !== 49) {
    return -1
  }
  let q: i32 = lead === 49 ? HTTP_Q_ONE : 0
  if (start + 1 === end) {
    return q
  }
  if (buf[start + 1] !== 46 || end - start > 5) {
    return -1
  }
  let scale: i32 = 100
  for (let i: i32 = start + 2; i < end; i += 1) {
    const d: i32 = toI32(buf[i]) - 48
    if (d < 0 || d > 9 || (lead === 49 && d !== 0)) {
      return -1
    }
    q += d * scale
    scale = scale / 10
  }
  return q
}

/** A coding's q: its own when listed, else `*`'s when that is, else 0. */
const httpQOrStar = (own: i32, star: i32): i32 => {
  if (own >= 0) {
    return own
  }
  return star >= 0 ? star : 0
}

/** Whether `c` is optional whitespace (SP or HTAB). */
const httpOws = (c: i32): boolean => c === 32 || c === 9

/**
 * The content coding to send for the `Accept-Encoding` field value
 * `buf[start .. end)` among the codings `offered` (`HTTP_OFFER_GZIP |
 * HTTP_OFFER_DEFLATE`): `HTTP_CODING_GZIP`, `HTTP_CODING_DEFLATE`,
 * `HTTP_CODING_IDENTITY` or `HTTP_CODING_NONE`, by the rules in the module
 * comment. A window outside `buf` panics.
 */
export const httpAcceptEncoding = (buf: u8[], start: i32, end: i32, offered: i32): i32 => {
  if (start < 0 || start > end || end > toI32(buf.length)) {
    panic("httpAcceptEncoding: the window lies outside its buffer")
  }
  let qGzip: i32 = -1
  let qDeflate: i32 = -1
  let qIdentity: i32 = -1
  let qStar: i32 = -1
  let p: i32 = start
  while (p < end) {
    // One element: OWS coding OWS *( ";" OWS name "=" value ) OWS ","
    while (p < end && (httpOws(toI32(buf[p])) || buf[p] === 44)) {
      p += 1
    }
    const codingStart: i32 = p
    while (p < end && httpCodingChar(toI32(buf[p]))) {
      p += 1
    }
    const codingEnd: i32 = p
    let q: i32 = HTTP_Q_ONE
    let valid: boolean = codingEnd > codingStart
    while (p < end && buf[p] !== 44) {
      while (p < end && httpOws(toI32(buf[p]))) {
        p += 1
      }
      if (p >= end || buf[p] === 44) {
        break
      }
      if (buf[p] !== 59) {
        valid = false
        while (p < end && buf[p] !== 44) {
          p += 1
        }
        break
      }
      p += 1
      while (p < end && httpOws(toI32(buf[p]))) {
        p += 1
      }
      const nameStart: i32 = p
      while (p < end && httpCodingChar(toI32(buf[p]))) {
        p += 1
      }
      const nameEnd: i32 = p
      if (p >= end || buf[p] !== 61) {
        valid = false
        continue
      }
      p += 1
      const valueStart: i32 = p
      while (p < end && httpCodingChar(toI32(buf[p]))) {
        p += 1
      }
      if (httpCodingIs(buf, nameStart, nameEnd, "q")) {
        q = httpQValue(buf, valueStart, p)
        if (q < 0) {
          valid = false
        }
      }
    }
    if (valid) {
      if (
        httpCodingIs(buf, codingStart, codingEnd, "gzip") ||
        httpCodingIs(buf, codingStart, codingEnd, "x-gzip")
      ) {
        qGzip = q
      } else if (httpCodingIs(buf, codingStart, codingEnd, "deflate")) {
        qDeflate = q
      } else if (httpCodingIs(buf, codingStart, codingEnd, "identity")) {
        qIdentity = q
      } else if (httpCodingIs(buf, codingStart, codingEnd, "*")) {
        qStar = q
      }
    }
  }
  const gzip: i32 = (offered & HTTP_OFFER_GZIP) === 0 ? 0 : httpQOrStar(qGzip, qStar)
  const deflate: i32 = (offered & HTTP_OFFER_DEFLATE) === 0 ? 0 : httpQOrStar(qDeflate, qStar)
  // `identity` unlisted (and not reached by `*`) is acceptable but stated no
  // preference, so any offered coding with q above 0 is sent before it.
  let identity: i32 = -1
  if (qIdentity >= 0) {
    identity = qIdentity
  } else if (qStar >= 0) {
    identity = qStar
  }
  let coding: i32 = HTTP_CODING_NONE
  let codingQ: i32 = 0
  if (deflate > gzip) {
    coding = HTTP_CODING_DEFLATE
    codingQ = deflate
  } else if (gzip > 0) {
    coding = HTTP_CODING_GZIP
    codingQ = gzip
  }
  if (coding !== HTTP_CODING_NONE && codingQ >= identity) {
    return coding
  }
  if (identity !== 0) {
    return HTTP_CODING_IDENTITY
  }
  return HTTP_CODING_NONE
}

/** The bytes of an ASCII string. */
const httpCompressBytes = (text: string): u8[] => {
  const out: u8[] = new Array<u8>(toI32(text.length))
  for (let i: i32 = 0; i < toI32(text.length) && i < toI32(out.length); i += 1) {
    out[i] = toU8(text.charCodeAt(i))
  }
  return out
}

/**
 * Compresses response bodies with gzip into a buffer of its own, and builds
 * the response fields that say so. One per thread; allocated once.
 */
export class HttpCompressor {
  readonly gzip: GzipCompressor
  /** Where `compress` writes; valid until the next call. */
  readonly output: u8[]
  /** The fields `addFields` built: the program's, then `Content-Encoding` and `Vary`. */
  readonly names: u8[][]
  readonly values: u8[][]
  readonly contentEncodingName: u8[]
  readonly gzipValue: u8[]
  readonly varyName: u8[]
  readonly acceptEncodingValue: u8[]
  /** The shortest body worth compressing, and the longest the output can hold. */
  readonly minLength: i32
  readonly maxLength: i32
  /**
   * Whether `addFields` adds `Vary: Accept-Encoding` (RFC 9110 §12.5.5), which
   * a cache needs whenever the same resource may be sent either way. On by
   * default; turn it off when the program sets its own `Vary`.
   */
  vary: boolean

  /**
   * A compressor at `level` (`DEFLATE_FAST` suits a server) for bodies of
   * `minLength` to `maxLength` bytes. A level outside 0 to 9, a negative
   * `minLength` or a `maxLength` below it panics.
   */
  constructor(level: i32, minLength: i32, maxLength: i32) {
    if (minLength < 0 || maxLength < minLength) {
      panic("HttpCompressor: the lengths are out of order")
    }
    this.gzip = new GzipCompressor(level)
    this.output = new Array<u8>(compressBound(maxLength))
    this.names = []
    this.values = []
    this.contentEncodingName = httpCompressBytes("content-encoding")
    this.gzipValue = httpCompressBytes("gzip")
    this.varyName = httpCompressBytes("vary")
    this.acceptEncodingValue = httpCompressBytes("accept-encoding")
    this.minLength = minLength
    this.maxLength = maxLength
    this.vary = true
  }

  /**
   * Compresses `body[off .. off + len)` into `output` when `coding` is
   * `HTTP_CODING_GZIP`, the length is in `[minLength, maxLength]` and gzip
   * makes it smaller; answers the compressed length, or -1 to send the body
   * as it is. A window outside `body` panics.
   */
  compress(coding: i32, body: u8[], off: i32, len: i32): i32 {
    if (off < 0 || len < 0 || off > toI32(body.length) - len) {
      panic("HttpCompressor.compress: the window lies outside its body")
    }
    if (coding !== HTTP_CODING_GZIP || len < this.minLength || len > this.maxLength) {
      return -1
    }
    const n: i32 = this.gzip.compress(body, off, len, this.output, 0)
    if (n < 0 || n >= len) {
      return -1
    }
    return n
  }

  /**
   * Sets `names` / `values` to the program's fields followed by
   * `Content-Encoding: gzip` and, when `vary`, `Vary: Accept-Encoding`. The
   * arrays are reused, so after the first few calls this allocates nothing;
   * they hold until the next call.
   */
  addFields(names: u8[][], values: u8[][]): void {
    while (this.names.length > 0) {
      this.names.pop()
    }
    while (this.values.length > 0) {
      this.values.pop()
    }
    for (let i: i32 = 0; i < toI32(names.length) && i < toI32(values.length); i += 1) {
      this.names.push(names[i])
      this.values.push(values[i])
    }
    this.names.push(this.contentEncodingName)
    this.values.push(this.gzipValue)
    this.addVary()
  }

  /** Appends `Vary: Accept-Encoding` to the arrays `addFields` built when `vary` is set. */
  addVary(): void {
    if (this.vary) {
      this.names.push(this.varyName)
      this.values.push(this.acceptEncodingValue)
    }
  }

  /**
   * Sets `names` / `values` to the program's fields and, when `vary`,
   * `Vary: Accept-Encoding`: the fields of a body sent as it is from a
   * resource that is sometimes compressed.
   */
  identityFields(names: u8[][], values: u8[][]): void {
    while (this.names.length > 0) {
      this.names.pop()
    }
    while (this.values.length > 0) {
      this.values.pop()
    }
    for (let i: i32 = 0; i < toI32(names.length) && i < toI32(values.length); i += 1) {
      this.names.push(names[i])
      this.values.push(values[i])
    }
    this.addVary()
  }
}

/** A compressor for the usual server: `DEFLATE_FAST`, bodies of 1 KB to 1 MB. */
export const httpCompressorDefault = (): HttpCompressor => new HttpCompressor(DEFLATE_FAST, 1024, 1048576)
