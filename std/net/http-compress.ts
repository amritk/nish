/**
 * `nish/net/http-compress` — content coding for HTTP responses (RFC 9110
 * §8.4 and §12.5.3): reading a request's `Accept-Encoding` and compressing a
 * body with `Content-Encoding: gzip` or `deflate`, for any of the three
 * servers.
 *
 *     import { DEFLATE_FAST } from "nish/compress/deflate";
 *     import { HTTP_OFFER_DEFLATE, HTTP_OFFER_GZIP, HttpCompressor, httpAcceptEncoding } from "nish/net/http-compress";
 *
 *     const enc = new HttpCompressor(DEFLATE_FAST, 1024, 65536); // once per thread
 *     // HTTP/1.1, in one call:
 *     conn.respondEncoded(200, names, values, body, 0, n, enc, conn.acceptEncoding());
 *     // HTTP/2 or HTTP/3, by hand:
 *     const coding: i32 = httpAcceptEncoding(value, 0, toI32(value.length), HTTP_OFFER_GZIP | HTTP_OFFER_DEFLATE);
 *     const m: i32 = enc.compress(coding, body, 0, n);
 *     if (m >= 0) {
 *       enc.addFields(names, values);
 *       h2.respond(id, 200, enc.names, enc.values, false);
 *       h2.writeData(id, enc.output, 0, m, true);
 *     }
 *
 * **Opt-in.** Nothing here runs unless the program asks: it decides which
 * responses to compress, and `HttpCompressor` declines any body shorter than
 * its `minLength`, longer than its `maxLength`, or that compressing would not
 * make smaller, answering -1 so the program sends the bytes as they are.
 *
 * **Compression that pays for itself.** A body is sent compressed only when it
 * saves at least `minSaving` bytes and `minSavingPercent` percent of the body;
 * otherwise the compressed bytes are dropped and the body goes as it is. With
 * `segmentMode` set, `respondEncoded` also sends it compressed only when the
 * whole response, head included, takes fewer TCP segments of `mss` bytes (the
 * connection's `mss` if set, else the compressor's `mss` if set, else the MSS
 * the server read from the socket, else `HTTP_DEFAULT_MSS`, 1448): a
 * 1300-byte body that gzips to 700 still fits in one segment either way.
 *
 *  After each call `decision` says why (`HTTP_COMPRESS_SENT`, `_NOT_ACCEPTED`,
 *  `_TOO_SMALL`, `_TOO_LARGE`, `_TOO_LITTLE_SAVED`, `_NO_FEWER_SEGMENTS`), for a
 *  program to count. A response whose identity form already fits one segment is
 *  `_NO_FEWER_SEGMENTS` without running an encoder at all, as no compression could
 *  take fewer.
 *
 * **Two encoders.** Bodies up to `fixedLimit` (16 KB) go through
 * `GzipFixedCompressor`: one fixed-Huffman block, a 16 KB window, no state
 * between calls, two to four times faster than `DEFLATE_FAST` on 0.5 to
 * 16 KB of JSON for output about 1.35 times larger. Larger bodies go through
 * the `GzipCompressor` at the level given; `encoder` forces either one.
 *
 * **Two codings.** `gzip` (RFC 1952) and `deflate`, which HTTP means as the
 * zlib format (RFC 1950, RFC 9110 §8.4.1.2), are the same DEFLATE stream in
 * different framing. A deflate body is written by the same two encoders as a
 * gzip member and reframed in place: the 10-byte gzip header becomes the
 * 2-byte zlib header, and the CRC-32 and length trailer an Adler-32, 12 bytes
 * shorter in all. So the compressor holds one set of tables for both, at the
 * cost of a CRC-32 it computes and drops on each deflate body.
 *
 * **`Vary: Accept-Encoding`** (with `vary`, on by default) goes on every
 * response whose coding depended on the request: one sent compressed, and
 * one sent as it is because the request did not accept the coding offered. A
 * body that is too small, too large or did not pay is sent the same to every
 * client, so it carries no `Vary`. `respondEncoded` sends gzip to a request
 * refusing identity whatever the policy (`compressAnyway`), up to `maxLength`;
 * deflate it holds to the policy, so such a caller calls `compressAnyway`.
 *
 * **Negotiation** (`httpAcceptEncoding`) follows §12.5.3: each listed coding
 * with its q-value, `x-gzip` as `gzip`, `*` for every coding not listed, and
 * `identity` acceptable unless it is given q=0, directly or through `*`.
 *
 *  Of the codings the program offers, the most preferred with q above 0 wins,
 *  the program's order (gzip, then deflate) breaking ties; it beats `identity`
 *  at an equal q, and beats an `identity` the field does not mention at any q.
 *  With no field at all the answer is `HTTP_CODING_IDENTITY` (the RFC allows any
 *  coding then, but a client that says nothing is safest sent nothing it may not
 *  read); an empty field asks for identity too. `HTTP_CODING_NONE` means nothing
 *  offered is acceptable and identity is refused: a server may answer 406 or
 *  send identity anyway. A malformed element is skipped. The parser allocates
 *  nothing.
 *
 * **Compressing allocates nothing** and caches nothing between responses:
 * `HttpCompressor` holds a `GzipCompressor`, a `GzipFixedCompressor`, an
 * output buffer of `compressBound(maxLength)` bytes and
 * the field arrays `addFields` fills, all built once.
 */
import { DEFLATE_ERR_OUTPUT_LIMIT, DEFLATE_FAST, compressBound } from "nish/compress/deflate"
import { adler32 } from "nish/compress/checksum"
import { GzipCompressor, GzipDecompressor, GzipFixedCompressor } from "nish/compress/gzip"
import { ZlibDecompressor } from "nish/compress/zlib"
import { wrappingAdd } from "nish:unsafe"

/** No content coding: the body as it is. */
export const HTTP_CODING_IDENTITY: i32 = 0

/** `gzip` (RFC 9110 §8.4.1.3), or its alias `x-gzip`. */
export const HTTP_CODING_GZIP: i32 = 1

/** `deflate`: the zlib format (RFC 9110 §8.4.1.2). */
export const HTTP_CODING_DEFLATE: i32 = 2

/** Nothing offered is acceptable, identity included (§12.5.3: 406, or identity anyway). */
export const HTTP_CODING_NONE: i32 = -1
/** `httpTryAcceptEncoding` and `httpTryContentEncoding`: the window lies outside its buffer. */
export const HTTP_CODING_BAD_WINDOW: i32 = -2

/** `httpAcceptEncoding`'s `offered` bits: the program can send gzip, deflate. */
export const HTTP_OFFER_GZIP: i32 = 1
/** The `offered` bit for deflate, which `HttpCompressor` sends in the zlib format. */
export const HTTP_OFFER_DEFLATE: i32 = 2

/**
 * What `HttpCompressor.compress` (and `respondEncoded`'s segment check) last
 * decided, in `HttpCompressor.decision`, for a program to count: the body
 * went out compressed; the client took neither gzip nor deflate; it was shorter than
 * `minLength`; longer than `maxLength`; compressing did not save `minSaving` bytes
 * and `minSavingPercent` percent; or the compressed response would not have
 * taken fewer TCP segments (`segmentMode`), which includes an identity
 * response that already fits one segment, decided without compressing.
 */
export const HTTP_COMPRESS_SENT: i32 = 0
/** The coding passed was neither gzip nor deflate, so the body went as it is; the default before any decision. */
export const HTTP_COMPRESS_NOT_ACCEPTED: i32 = 1
/** The body was shorter than `minLength`, too small to be worth compressing. */
export const HTTP_COMPRESS_TOO_SMALL: i32 = 2
/** The body was longer than `maxLength`, more than `output` was sized for. */
export const HTTP_COMPRESS_TOO_LARGE: i32 = 3
/**
 * An encoder ran but did not save `minSaving` bytes and `minSavingPercent` percent,
 * or the saving asked for was the whole body, so no encoder ran.
 */
export const HTTP_COMPRESS_TOO_LITTLE_SAVED: i32 = 4
/** Under `segmentMode`, compressing would not have saved a TCP segment. */
export const HTTP_COMPRESS_NO_FEWER_SEGMENTS: i32 = 5
/**
 * The encoder's gzip member could not be written into `output` or reframed as
 * zlib, so the body went as it is. `output` is built with
 * `compressBound(maxLength)` bytes, room for any body `compress` or
 * `compressAnyway` accepts; it is reached when a caller has since shrunk
 * `output` (`readonly` keeps the array, not its length).
 */
export const HTTP_COMPRESS_FAILED: i32 = 6
/** `tryCompress` and `tryCompressAnyway`: the window lies outside the body, so nothing was compressed. */
export const HTTP_COMPRESS_BAD_WINDOW: i32 = 7

/**
 * `HttpCompressor.encoder`: by the body's length (the fixed-Huffman encoder up
 * to `fixedLimit` bytes, the constructor's level above), the fixed-Huffman
 * encoder always, or the constructor's level always.
 */
export const HTTP_ENCODER_AUTO: i32 = 0
/**
 * The fixed-Huffman encoder for every body `compress` takes: fastest, at some
 * cost in size on large bodies. `compressAnyway` falls back to the
 * `GzipCompressor` when it fails.
 */
export const HTTP_ENCODER_FIXED: i32 = 1
/** Always the `GzipCompressor` at the constructor's level, whatever the body's length. */
export const HTTP_ENCODER_LEVEL: i32 = 2

/**
 * The maximum segment size `segmentMode` counts with unless told the
 * connection's: a 1500-byte Ethernet MTU less 20 bytes of IPv4 header, 20 of
 * TCP header and 12 of the timestamp option.
 */
export const HTTP_DEFAULT_MSS: i32 = 1448

/** The bytes `content-encoding: gzip` adds to an HTTP/1.1 head: name, value, ": " and CRLF. */
export const HTTP1_GZIP_FIELD_BYTES: i32 = 24

/** How many bytes shorter a zlib stream is than the gzip member around the same DEFLATE stream: a 10-byte header and 8-byte trailer against 2 and 4. */
const HTTP_ZLIB_SHORTER: i32 = 12

/** `httpGzipToZlib`: the member was too short to reframe or passed its buffer. */
const HTTP_ZLIB_FAILED: i32 = -1

/**
 * The number of TCP segments `bytes` bytes take at `mss` bytes a segment.
 * A segment size of zero or less panics, since no count would mean anything.
 *
 * @param bytes the length of the whole response, head and body, in bytes
 * @param mss the payload one segment carries, in bytes
 * @returns how many segments the bytes fill, the last one possibly partial;
 *   0 for no bytes
 */
export const httpSegments = (bytes: i32, mss: i32): i32 => {
  if (mss <= 0) {
    panic("httpSegments: a segment size of zero or less")
  }
  return httpSegmentsOf(bytes, toU32(mss))
}

/**
 * `httpSegments` without its panic, for a `size` its caller has shown is 1 or
 * more: `httpSegments` by its panic, `fewerSegments` by `segmentSize`, which
 * answers a size above 0 or `HTTP_DEFAULT_MSS`. A `size` of 0 counts 0.
 */
const httpSegmentsOf = (bytes: i32, size: u32): i32 => {
  if (bytes <= 0) {
    return 0
  }
  // `size` is 1 or more, so the quotient is at most `bytes - 1` and the sum
  // at most `bytes`: unsigned arithmetic gives the same count with no check.
  // Both callers pass 1 or more, so the test always holds; it is what shows
  // the division has a divisor.
  if (size > 0) {
    return toI32((toU32(bytes) - 1) / size + 1)
  }
  return 0
}

/** The digits of `n` in decimal, `n` 0 or more. */
const httpDecimalDigits = (n: i32): i32 => {
  let digits: i32 = 1
  let rest: i32 = n
  // An `i32` has at most ten digits, so the second test always holds; it is
  // what shows the count cannot run past them.
  while (rest >= 10 && digits < 10) {
    rest = rest / 10
    digits += 1
  }
  return digits
}

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
  // `j` walks `buf` and `i` walks `word` side by side. A window outside `buf`
  // stops the walk short of the word's end, which answers false.
  let i: i32 = 0
  for (let j: i32 = start; j >= 0 && j < end && j < toI32(buf.length) && i < toI32(word.length); j += 1) {
    let c: i32 = toI32(buf[j])
    if (c >= 65 && c <= 90) {
      c += 32
    }
    if (c !== toI32(word.charCodeAt(i))) {
      return false
    }
    i += 1
  }
  return i === toI32(word.length)
}

/**
 * The q-value of `buf[start .. end)`, in thousandths (RFC 9110 §12.4.2:
 * `0`, `0.` and up to three digits, `1`, `1.` and up to three zeros), or -1
 * when it is not one.
 */
const httpQValue = (buf: u8[], start: i32, end: i32): i32 => {
  if (start >= end || start < 0 || start >= toI32(buf.length)) {
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
  const dot: i32 = start + 1
  if (dot >= toI32(buf.length) || buf[dot] !== 46 || end - start > 5) {
    return -1
  }
  let scale: i32 = 100
  for (let i: i32 = dot + 1; i < end && i >= 0 && i < toI32(buf.length); i += 1) {
    const d: i32 = toI32(buf[i]) - 48
    if (d < 0 || d > 9 || (lead === 49 && d !== 0)) {
      return -1
    }
    // At most three digits follow the point, each 9 or less at a scale of 100
    // or less, so `q` stays under 1000 and unsigned arithmetic cannot wrap.
    q = toI32(toU32(q) + toU32(d) * toU32(scale))
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
 *
 * @param buf the buffer holding the field value, such as the request head
 * @param start the index in `buf` of the value's first octet
 * @param end the index just past the value's last octet
 * @param offered which codings the program can produce, `HTTP_OFFER_*` bits
 *   or 0 for none
 * @returns the `HTTP_CODING_*` to send the body in, or `HTTP_CODING_NONE`
 *   when nothing offered is acceptable and identity is refused too
 */
export const httpAcceptEncoding = (buf: u8[], start: i32, end: i32, offered: i32): i32 => {
  const coding: i32 = httpTryAcceptEncoding(buf, start, end, offered)
  if (coding === HTTP_CODING_BAD_WINDOW) {
    panic("httpAcceptEncoding: the window lies outside its buffer")
  }
  return coding
}

/**
 * `httpAcceptEncoding` that answers `HTTP_CODING_BAD_WINDOW` where
 * `httpAcceptEncoding` panics: a window outside `buf`. A caller a strict
 * module reaches uses this one.
 *
 * @param buf the buffer holding the field value, such as the request head
 * @param start the index in `buf` of the value's first octet
 * @param end the index just past the value's last octet
 * @param offered which codings the program can produce, `HTTP_OFFER_*` bits
 *   or 0 for none
 * @returns the `HTTP_CODING_*` to send the body in, `HTTP_CODING_NONE` when
 *   nothing offered is acceptable, or `HTTP_CODING_BAD_WINDOW`
 */
export const httpTryAcceptEncoding = (buf: u8[], start: i32, end: i32, offered: i32): i32 => {
  if (start < 0 || start > end || end > toI32(buf.length)) {
    return HTTP_CODING_BAD_WINDOW
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

/**
 * Whether the `Accept-Encoding` value in `buf[start .. end)` refuses the
 * body as it is: `identity;q=0`, or `*;q=0` with no `identity` listed. A
 * server should then send a coding the client takes even where it would not
 * bother (`HttpCompressor.compressAnyway`).
 *
 * @param buf the buffer holding the field value, such as the request head
 * @param start the index in `buf` of the value's first octet
 * @param end the index just past the value's last octet
 * @returns true when the client said it cannot take the body uncompressed
 */
export const httpIdentityRefused = (buf: u8[], start: i32, end: i32): boolean =>
  httpAcceptEncoding(buf, start, end, 0) === HTTP_CODING_NONE

/** The bytes of an ASCII string. */
const httpCompressBytes = (text: string): u8[] => {
  const out: u8[] = []
  for (let i: i32 = 0; i < toI32(text.length); i += 1) {
    out.push(toU8(text.charCodeAt(i)))
  }
  return out
}

/**
 * Reframes the gzip member `out[0 .. n)` (a 10-byte header with no optional
 * fields, as `GzipCompressor` and `GzipFixedCompressor` write) as the zlib
 * stream of the same DEFLATE stream, in place: the header `0x78` and the
 * `FLEVEL` of `level` (RFC 1950 §2.2), the DEFLATE stream moved down 8 bytes,
 * and the Adler-32 of `src[off .. off + len)`, the data compressed.
 *
 * @returns the zlib stream's length, `n - HTTP_ZLIB_SHORTER`; or
 *   `HTTP_ZLIB_FAILED` when `out[0 .. n)` is too short to be a gzip member or
 *   passes `out`, which its callers turn into `HTTP_COMPRESS_FAILED`
 */
const httpGzipToZlib = (out: u8[], n: i32, level: i32, src: u8[], off: i32, len: i32): i32 => {
  let flevel: u32 = 3
  if (level < 2) {
    flevel = 0
  } else if (level < 6) {
    flevel = 1
  } else if (level === 6) {
    flevel = 2
  }
  const cmf: u32 = 0x78
  const top: u32 = flevel << 6
  // FCHECK makes `cmf * 256 + flg` a multiple of 31. Every number here is
  // under 31000, so unsigned arithmetic cannot wrap.
  const flg: u32 = top + ((toU32(31) - ((cmf * 256 + top) % 31)) % 31)
  // Both callers pass what an encoder just wrote at the start of `out`: at
  // least 18 bytes of gzip header and trailer, inside `out`. So the tests
  // hold; they are what prove the writes below in bounds, and a miss answers
  // `HTTP_ZLIB_FAILED`, which sends the body as it is.
  if (n < 18 || n > toI32(out.length) || toI32(out.length) < 2) {
    return HTTP_ZLIB_FAILED
  }
  const end: i32 = n - HTTP_ZLIB_SHORTER - 4
  if (end < 0 || end + 3 >= toI32(out.length)) {
    return HTTP_ZLIB_FAILED
  }
  out[0] = toU8(cmf)
  out[1] = toU8(flg)
  for (let i: i32 = 2; i < end && i >= 0 && i + 8 < toI32(out.length); i += 1) {
    out[i] = out[i + 8]
  }
  const a: u32 = adler32(src, off, len)
  out[end] = toU8(a >>> 24)
  out[end + 1] = toU8((a >>> 16) & 255)
  out[end + 2] = toU8((a >>> 8) & 255)
  out[end + 3] = toU8(a & 255)
  return end + 4
}

/**
 * Compresses response bodies with gzip or deflate into a buffer of its own, and builds
 * the response fields that say so. One per thread; allocated once.
 */
export class HttpCompressor {
  private readonly gzip: GzipCompressor
  /** The small-body encoder: one fixed-Huffman block, nothing kept between calls. */
  private readonly fixed: GzipFixedCompressor
  /** Where `compress` writes; valid until the next call. */
  readonly output: u8[]
  /** The fields `addFields` built: the program's, then `Content-Encoding` and `Vary`. */
  readonly names: u8[][]
  /** The value of each field in `names`, at the same index; pass both to `respond`. */
  readonly values: u8[][]
  private readonly contentEncodingName: u8[]
  private readonly gzipValue: u8[]
  private readonly deflateValue: u8[]
  /** The `Content-Encoding` value `addFields` adds: that of the last body sent compressed, gzip before any. */
  private codingValue: u8[]
  /** The constructor's deflate level, which a deflate body's zlib header names. */
  private readonly level: i32
  private readonly varyName: u8[]
  private readonly acceptEncodingValue: u8[]
  /** The shortest body worth compressing, and the longest the output can hold. */
  private readonly minLength: i32
  private readonly maxLength: i32
  /**
   * The least a compressed body must save to be sent: `minSaving` bytes and
   * `minSavingPercent` percent of the body, whichever is more. 1 and 0 by
   * default (any saving at all); a value below those counts as them.
   */
  minSaving: i32
  /** The percent of the body a compressed body must save, as well as `minSaving` bytes: 0 by default, 100 or more sends nothing compressed. */
  minSavingPercent: i32
  /**
   * Whether `addFields` adds `Vary: Accept-Encoding` (RFC 9110 §12.5.5), which
   * a cache needs whenever the same resource may be sent either way. On by
   * default; turn it off when the program sets its own `Vary`.
   */
  vary: boolean
  /**
   * Whether `respondEncoded` also sends the compressed response only when,
   * head included, it takes fewer TCP segments of `mss` bytes than the body
   * as it is; off by default. Segments are the connection's own `mss` if the
   * program set it, else this compressor's `mss` if set, else the socket's MSS
   * the server read on accept, else `HTTP_DEFAULT_MSS`.
   */
  segmentMode: boolean
  /**
   * The TCP segment size `segmentMode` counts in, in bytes, when the program
   * sets it: 0 (the default) or less means unset, so a connection's socket MSS
   * is used, or `HTTP_DEFAULT_MSS` where there is none. A value set here wins
   * over the socket's; a connection's own `mss` wins over it.
   */
  mss: i32
  /** `HTTP_ENCODER_AUTO` (the default), `HTTP_ENCODER_FIXED` or `HTTP_ENCODER_LEVEL`. */
  encoder: i32
  /** The longest body `HTTP_ENCODER_AUTO` gives the fixed-Huffman encoder: 16384 by default. */
  fixedLimit: i32
  /** The last decision, an `HTTP_COMPRESS_*`; `HTTP_COMPRESS_NOT_ACCEPTED` before any. */
  decision: i32
  /**
   * How many times `compress` and `compressAnyway` ran an encoder, from 0: a
   * count for a test or a profile to read, never consulted by a decision. It
   * wraps past 2^31 - 1 to -2^31 rather than panic, as a server can run that
   * many; read it as a difference between two reads.
   */
  encoderRuns: i32

  /**
   * A compressor at `level` (`DEFLATE_FAST` suits a server) for bodies of
   * `minLength` to `maxLength` bytes. A level outside 0 to 9, a negative
   * `minLength` or a `maxLength` below it panics.
   *
   * @param level the deflate level, 0 to 9, for bodies past `fixedLimit`, and
   *   for every body when `encoder` is `HTTP_ENCODER_LEVEL`
   * @param minLength the shortest body worth compressing, in bytes
   * @param maxLength the longest body it will compress, in bytes; `output` is
   *   sized for it once, here
   */
  constructor(level: i32, minLength: i32, maxLength: i32) {
    if (minLength < 0 || maxLength < minLength) {
      panic("HttpCompressor: the lengths are out of order")
    }
    this.gzip = new GzipCompressor(level)
    this.fixed = new GzipFixedCompressor()
    // Grown a byte at a time, once: a length the compiler cannot see is not
    // negative would cost `new Array` a check. No bench/instructions.json row
    // builds a compressor, so no counted figure includes this loop.
    const output: u8[] = []
    const bound: i32 = compressBound(maxLength)
    while (toI32(output.length) < bound) {
      output.push(0)
    }
    this.output = output
    this.names = []
    this.values = []
    this.contentEncodingName = httpCompressBytes("content-encoding")
    this.gzipValue = httpCompressBytes("gzip")
    this.deflateValue = httpCompressBytes("deflate")
    this.codingValue = this.gzipValue
    this.level = level
    this.varyName = httpCompressBytes("vary")
    this.acceptEncodingValue = httpCompressBytes("accept-encoding")
    this.minLength = minLength
    this.maxLength = maxLength
    this.vary = true
    this.minSaving = 1
    this.minSavingPercent = 0
    this.segmentMode = false
    this.mss = 0
    this.encoder = HTTP_ENCODER_AUTO
    this.fixedLimit = 16384
    this.decision = HTTP_COMPRESS_NOT_ACCEPTED
    this.encoderRuns = 0
  }

  /**
   * Compresses `body[off .. off + len)` into `output` when the length is in
   * `[minLength, maxLength]`, `coding` is `HTTP_CODING_GZIP` or
   * `HTTP_CODING_DEFLATE` and compressing saves what `minSaving` and
   * `minSavingPercent` ask; answers the compressed
   * length, or -1 to send the body as it is, and sets `decision` either way.
   * `encoder` picks the encoder; the fixed-Huffman one stops as soon as its
   * output passes what would be kept. A window outside `body` panics.
   *
   * @param coding the coding negotiated for this request, from
   *   `httpAcceptEncoding`
   * @param body the buffer holding the response body
   * @param off the index in `body` where the body starts
   * @param len the body's length in bytes
   * @returns how many bytes of `output` hold the gzip or deflate body, or -1
   *   to send the body uncompressed; `decision` says which reason applied
   */
  compress(coding: i32, body: u8[], off: i32, len: i32): i32 {
    const n: i32 = this.tryCompress(coding, body, off, len)
    if (this.decision === HTTP_COMPRESS_BAD_WINDOW) {
      panic("HttpCompressor.compress: the window lies outside its body")
    }
    return n
  }

  /**
   * `compress` that answers -1 with `decision` set to
   * `HTTP_COMPRESS_BAD_WINDOW` where `compress` panics: a window outside
   * `body`. A caller a strict module reaches uses this one.
   *
   * @param coding the coding negotiated for this request, from
   *   `httpAcceptEncoding`
   * @param body the buffer holding the response body
   * @param off the index in `body` where the body starts
   * @param len the body's length in bytes
   * @returns how many bytes of `output` hold the gzip or deflate body, or -1
   *   to send the body uncompressed; `decision` says which reason applied
   */
  tryCompress(coding: i32, body: u8[], off: i32, len: i32): i32 {
    if (off < 0 || len < 0 || off > toI32(body.length) - len) {
      this.decision = HTTP_COMPRESS_BAD_WINDOW
      return -1
    }
    if (len < this.minLength) {
      this.decision = HTTP_COMPRESS_TOO_SMALL
      return -1
    }
    if (len > this.maxLength) {
      this.decision = HTTP_COMPRESS_TOO_LARGE
      return -1
    }
    const deflate: boolean = coding === HTTP_CODING_DEFLATE
    if (coding !== HTTP_CODING_GZIP && !deflate) {
      this.decision = HTTP_COMPRESS_NOT_ACCEPTED
      return -1
    }
    // The longest output kept; `output` holds `compressBound(maxLength)`, more.
    // `len` is 0 or more and the saving 1 or more, so the difference is an
    // `i32` and unsigned arithmetic gives it with no check.
    const keep: i32 = toI32(toU32(len) - toU32(this.leastSaving(len)))
    let n: i32 = -1
    if (keep > 0) {
      const fixed: boolean =
        this.encoder === HTTP_ENCODER_FIXED || (this.encoder !== HTTP_ENCODER_LEVEL && len <= this.fixedLimit)
      this.encoderRuns = wrappingAdd(this.encoderRuns, 1)
      // A gzip member `HTTP_ZLIB_SHORTER` bytes over `keep` still makes a deflate body that fits.
      let room: i32 = keep
      if (deflate) {
        // Below `size - HTTP_ZLIB_SHORTER`, `keep` plus that many is below
        // `size`, so the unsigned sum is the `i32` one.
        const size: i32 = toI32(this.output.length)
        room = keep < size - HTTP_ZLIB_SHORTER ? toI32(toU32(keep) + toU32(HTTP_ZLIB_SHORTER)) : size
      }
      n = fixed
        ? this.fixed.compress(body, off, len, this.output, toI32(0), room)
        : this.gzip.compress(body, off, len, this.output, toI32(0))
      if (deflate && n >= 0) {
        n = httpGzipToZlib(this.output, n, fixed ? toI32(1) : this.level, body, off, len)
        if (n === HTTP_ZLIB_FAILED) {
          this.decision = HTTP_COMPRESS_FAILED
          return -1
        }
      }
    }
    if (n < 0 || n > keep) {
      this.decision = HTTP_COMPRESS_TOO_LITTLE_SAVED
      return -1
    }
    this.sent(deflate)
    return n
  }

  /** Records a body sent compressed, and the coding `addFields` names for it. */
  private sent(deflate: boolean): void {
    this.decision = HTTP_COMPRESS_SENT
    this.codingValue = deflate ? this.deflateValue : this.gzipValue
  }

  /**
   * `compress` for a client that refuses identity (`httpIdentityRefused`):
   * gzip or deflate whatever the body's length, the saving or the
   * segments, so long as it is no longer than `maxLength`. Answers the
   * compressed length, or -1 when `coding` is neither gzip nor deflate or the
   * body is too long (sent as it is, which RFC 9110 §12.5.3 allows).
   *
   * @param coding the coding negotiated for this request, from
   *   `httpAcceptEncoding`
   * @param body the buffer holding the response body
   * @param off the index in `body` where the body starts
   * @param len the body's length in bytes
   * @returns how many bytes of `output` hold the gzip or deflate body, or -1
   *   to send the body uncompressed
   */
  compressAnyway(coding: i32, body: u8[], off: i32, len: i32): i32 {
    const n: i32 = this.tryCompressAnyway(coding, body, off, len)
    if (this.decision === HTTP_COMPRESS_BAD_WINDOW) {
      panic("HttpCompressor.compressAnyway: the window lies outside its body")
    }
    return n
  }

  /**
   * `compressAnyway` that answers -1 with `decision` set to
   * `HTTP_COMPRESS_BAD_WINDOW` where `compressAnyway` panics: a window outside
   * `body`. A caller a strict module reaches uses this one.
   *
   * @param coding the coding negotiated for this request, from
   *   `httpAcceptEncoding`
   * @param body the buffer holding the response body
   * @param off the index in `body` where the body starts
   * @param len the body's length in bytes
   * @returns how many bytes of `output` hold the gzip or deflate body, or -1
   *   to send the body uncompressed
   */
  tryCompressAnyway(coding: i32, body: u8[], off: i32, len: i32): i32 {
    if (off < 0 || len < 0 || off > toI32(body.length) - len) {
      this.decision = HTTP_COMPRESS_BAD_WINDOW
      return -1
    }
    if (len > this.maxLength) {
      this.decision = HTTP_COMPRESS_TOO_LARGE
      return -1
    }
    const deflate: boolean = coding === HTTP_CODING_DEFLATE
    if (coding !== HTTP_CODING_GZIP && !deflate) {
      this.decision = HTTP_COMPRESS_NOT_ACCEPTED
      return -1
    }
    this.encoderRuns = wrappingAdd(this.encoderRuns, 1)
    let n: i32 = -1
    let level: i32 = this.level
    if (
      this.encoder === HTTP_ENCODER_FIXED ||
      (this.encoder !== HTTP_ENCODER_LEVEL && len <= this.fixedLimit)
    ) {
      n = this.fixed.compress(body, off, len, this.output, toI32(0), toI32(this.output.length))
      level = 1
    }
    if (n < 0) {
      n = this.gzip.compress(body, off, len, this.output, toI32(0))
      level = this.level
    }
    if (deflate && n >= 0) {
      n = httpGzipToZlib(this.output, n, level, body, off, len)
    }
    if (n < 0) {
      // `output` holds `compressBound(maxLength)` bytes, so an encoder always
      // fits, and its member is long enough to reframe; were either to fail,
      // the body goes out as it is.
      this.decision = HTTP_COMPRESS_FAILED
      return -1
    }
    this.sent(deflate)
    return n
  }

  /**
   * The bytes a compressed `len`-byte body must save: `minSaving` and `minSavingPercent`, at least 1.
   *
   * @param len the uncompressed body's length in bytes
   * @returns the fewest bytes compressing must shave off for the compressed body to
   *   be sent, never below 1; the percent share rounds up
   */
  leastSaving(len: i32): i32 {
    let least: i32 = this.minSaving > 1 ? this.minSaving : 1
    let pct: i32 = this.minSavingPercent
    if (pct < 0) {
      pct = 0
    } else if (pct > 100) {
      pct = 100
    }
    const share: i32 = toI32((toI64(len) * toI64(pct) + toI64(99)) / toI64(100))
    if (share > least) {
      least = share
    }
    return least
  }

  /**
   * `segmentMode`'s rule, for a response of `identityBytes` bytes sent as it
   * is or `encodedBytes` compressed, heads included, at `mss` bytes a segment
   * (`this.mss` when 0 or less, and `HTTP_DEFAULT_MSS` when both are, as
   * `segmentSize` reads it): whether the compressed one takes fewer segments.
   * When it does not, `decision` becomes `HTTP_COMPRESS_NO_FEWER_SEGMENTS`.
   * `respondEncoded` calls it; a program driving HTTP/2 or HTTP/3 by hand may
   * with its own head sizes.
   *
   * @param identityBytes the whole response's length sent uncompressed, head
   *   included, in bytes
   * @param encodedBytes the whole response's length sent compressed, head
   *   included, in bytes
   * @param mss the connection's segment size in bytes, or 0 or less for the
   *   compressor's own
   * @returns true when compressing saves at least one segment, so the
   *   compressed response is worth sending
   */
  fewerSegments(identityBytes: i32, encodedBytes: i32, mss: i32): boolean {
    // `segmentSize` answers 1 or more, so neither count can be refused.
    const size: u32 = toU32(this.segmentSize(mss))
    if (httpSegmentsOf(encodedBytes, size) < httpSegmentsOf(identityBytes, size)) {
      return true
    }
    this.decision = HTTP_COMPRESS_NO_FEWER_SEGMENTS
    return false
  }

  /**
   * The segment `segmentMode` counts in: `mss` when above 0, else `this.mss` when above 0, else `HTTP_DEFAULT_MSS`.
   *
   * @internal Called by std/net/http1-server.ts to find the segment size its
   *   connection counts a response in before it decides whether to compress.
   */
  segmentSize(mss: i32): i32 {
    if (mss > 0) {
      return mss
    }
    return this.mss > 0 ? this.mss : HTTP_DEFAULT_MSS
  }

  /**
   * `segmentMode`'s shortcut, before any encoder runs: whether a `len`-byte
   * body that `compress` would try (its length in `[minLength, maxLength]`
   * and `coding` gzip or deflate) is no longer than one segment of `mss` bytes (as
   * `fewerSegments` reads it). Sent as it is, such a response takes one
   * segment once its head fits beside it, and no compression takes fewer, so
   * `decision` becomes `HTTP_COMPRESS_NO_FEWER_SEGMENTS` and the caller checks
   * the head: when it does not fit, the caller goes on to `compress`, which
   * decides again. Anything else answers false and leaves `decision` alone.
   *
   * @param coding the coding negotiated for this request
   * @param len the body's length in bytes
   * @param mss the connection's segment size in bytes, or 0 or less for the
   *   compressor's own
   * @returns true when the body fits one segment, so compressing it cannot
   *   help and it is sent as it is if its head fits too; false when `coding` is
   *   neither gzip nor deflate, `len` is outside `[minLength, maxLength]`, or the body does not
   *   fit one segment
   */
  oneSegment(coding: i32, len: i32, mss: i32): boolean {
    if (
      (coding !== HTTP_CODING_GZIP && coding !== HTTP_CODING_DEFLATE) ||
      len < this.minLength ||
      len > this.maxLength ||
      len > this.segmentSize(mss)
    ) {
      return false
    }
    this.decision = HTTP_COMPRESS_NO_FEWER_SEGMENTS
    return true
  }

  /**
   * The bytes of the HTTP/1.1 head a `length`-byte body sent as it is would
   * get, from `encodedHead`, that of the same response sent compressed as
   * `encodedLength` bytes with the fields `addFields` built: less
   * `Content-Encoding` and its value, less `Vary` (a body the segment count kept as
   * it is would go out so to any client), and the other `Content-Length`.
   *
   * @param encodedHead the compressed response's HTTP/1.1 head length in bytes
   * @param encodedLength the compressed body's length in bytes, as its
   *   `Content-Length` spells it
   * @param length the uncompressed body's length in bytes
   * @returns the head length, in bytes, the same response would have sent
   *   uncompressed
   */
  http1IdentityHead(encodedHead: i32, encodedLength: i32, length: i32): i32 {
    // `encodedHead` is a head's length, and every field here a few bytes, so
    // the answer is an `i32`; unsigned arithmetic wraps on the way and lands
    // on the same bytes with no check.
    let head: u32 =
      toU32(encodedHead) -
      toU32(HTTP1_GZIP_FIELD_BYTES) +
      toU32(this.gzipValue.length) -
      toU32(this.codingValue.length)
    if (this.vary) {
      head -= toU32(this.varyName.length) + toU32(this.acceptEncodingValue.length) + 4
    }
    return toI32(head - toU32(httpDecimalDigits(encodedLength)) + toU32(httpDecimalDigits(length)))
  }

  /**
   * Whether the last decision depended on the request's `Accept-Encoding`, so
   * the response needs `Vary: Accept-Encoding`: a body sent compressed, or
   * one sent as it is because the client took neither gzip nor deflate. A body the
   * lengths or the saving kept as it is would go out the same to any client.
   *
   * @returns true when the response must carry `Vary: Accept-Encoding` so a
   *   cache does not hand it to a client that asked differently
   */
  varies(): boolean {
    return this.decision === HTTP_COMPRESS_SENT || this.decision === HTTP_COMPRESS_NOT_ACCEPTED
  }

  /**
   * Sets `names` / `values` to the program's fields followed by
   * `Content-Encoding` naming the coding of the last body `compress` or
   * `compressAnyway` sent (`gzip` before any) and, when `vary`, `Vary: Accept-Encoding`. The
   * arrays are reused, so after the first few calls this allocates nothing;
   * they hold until the next call.
   *
   * @param names the program's own response field names, in order
   * @param values the value for each name, at the same index; a value with
   *   no name beside it is left out
   */
  addFields(names: u8[][], values: u8[][]): void {
    while (this.names.length > 0) {
      this.names.pop()
    }
    while (this.values.length > 0) {
      this.values.pop()
    }
    for (let i: i32 = 0; i < toI32(values.length); i += 1) {
      if (i < toI32(names.length)) {
        const name: u8[] = names[i]
        const value: u8[] = values[i]
        this.names.push(name)
        this.values.push(value)
      }
    }
    this.names.push(this.contentEncodingName)
    this.values.push(this.codingValue)
    if (this.vary) {
      this.names.push(this.varyName)
      this.values.push(this.acceptEncodingValue)
    }
  }

  /**
   * Appends `Vary: Accept-Encoding` to the arrays `identityFields` built when
   * `vary` is set and the last decision `varies`.
   */
  private addVary(): void {
    if (this.vary && this.varies()) {
      this.names.push(this.varyName)
      this.values.push(this.acceptEncodingValue)
    }
  }

  /**
   * Sets `names` / `values` to the program's fields and, when `vary` and the
   * last decision `varies`, `Vary: Accept-Encoding`: the fields of a body
   * sent as it is from a resource that is sometimes compressed.
   *
   * @param names the program's own response field names, in order
   * @param values the value for each name, at the same index; a value with
   *   no name beside it is left out
   */
  identityFields(names: u8[][], values: u8[][]): void {
    while (this.names.length > 0) {
      this.names.pop()
    }
    while (this.values.length > 0) {
      this.values.pop()
    }
    for (let i: i32 = 0; i < toI32(values.length); i += 1) {
      if (i < toI32(names.length)) {
        const name: u8[] = names[i]
        const value: u8[] = values[i]
        this.names.push(name)
        this.values.push(value)
      }
    }
    this.addVary()
  }
}

/**
 * A compressor for the usual server: `DEFLATE_FAST`, bodies of 1 KB to 1 MB.
 *
 * @returns a new compressor the caller owns, one per thread, with every
 *   other setting at its default
 */
export const httpCompressorDefault = (): HttpCompressor => new HttpCompressor(DEFLATE_FAST, 1024, 1048576)

/**
 * The content coding a `Content-Encoding` value `buf[start .. end)` names
 * (RFC 9110 §8.4): `HTTP_CODING_GZIP` for `gzip` or `x-gzip`,
 * `HTTP_CODING_DEFLATE` for `deflate`, `HTTP_CODING_IDENTITY` for an empty
 * value or `identity`, ignoring case, optional whitespace and empty list
 * elements. Anything else — an unknown coding, a byte no coding holds, or
 * two codings applied one over the other — is `HTTP_CODING_NONE`, which a
 * reader cannot undo in one step. A window outside `buf` panics.
 * @param buf the bytes that hold the field value
 * @param start where the value starts in `buf`
 * @param end where the value ends in `buf`, one past its last byte
 * @returns the one coding named, `HTTP_CODING_IDENTITY` for none, or `HTTP_CODING_NONE`
 */
export const httpContentEncoding = (buf: u8[], start: i32, end: i32): i32 => {
  const coding: i32 = httpTryContentEncoding(buf, start, end)
  if (coding === HTTP_CODING_BAD_WINDOW) {
    panic("httpContentEncoding: the window lies outside its buffer")
  }
  return coding
}

/**
 * `httpContentEncoding` that answers `HTTP_CODING_BAD_WINDOW` where
 * `httpContentEncoding` panics: a window outside `buf`. A caller a strict
 * module reaches uses this one.
 * @param buf the bytes that hold the field value
 * @param start where the value starts in `buf`
 * @param end where the value ends in `buf`, one past its last byte
 * @returns the one coding named, `HTTP_CODING_IDENTITY` for none, `HTTP_CODING_NONE`, or `HTTP_CODING_BAD_WINDOW`
 */
export const httpTryContentEncoding = (buf: u8[], start: i32, end: i32): i32 => {
  if (start < 0 || start > end || end > toI32(buf.length)) {
    return HTTP_CODING_BAD_WINDOW
  }
  let coding: i32 = HTTP_CODING_IDENTITY
  let p: i32 = start
  while (p < end) {
    while (p < end && (httpOws(toI32(buf[p])) || buf[p] === 44)) {
      p += 1
    }
    if (p >= end) {
      break
    }
    const codingStart: i32 = p
    while (p < end && httpCodingChar(toI32(buf[p]))) {
      p += 1
    }
    const codingEnd: i32 = p
    while (p < end && httpOws(toI32(buf[p]))) {
      p += 1
    }
    if (codingEnd === codingStart || (p < end && buf[p] !== 44)) {
      return HTTP_CODING_NONE
    }
    let named: i32 = HTTP_CODING_NONE
    if (
      httpCodingIs(buf, codingStart, codingEnd, "gzip") ||
      httpCodingIs(buf, codingStart, codingEnd, "x-gzip")
    ) {
      named = HTTP_CODING_GZIP
    } else if (httpCodingIs(buf, codingStart, codingEnd, "deflate")) {
      named = HTTP_CODING_DEFLATE
    } else if (httpCodingIs(buf, codingStart, codingEnd, "identity")) {
      continue
    }
    if (named === HTTP_CODING_NONE || coding !== HTTP_CODING_IDENTITY) {
      return HTTP_CODING_NONE
    }
    coding = named
  }
  return coding
}

/** `HttpBodyDecoder.decode`: the body decodes to more than `limit` bytes. */
export const HTTP_DECODE_TOO_LARGE: i32 = -1
/** `HttpBodyDecoder.decode`: the body is not a whole, well-formed stream of its coding. */
export const HTTP_DECODE_MALFORMED: i32 = -2
/**
 * `HttpBodyDecoder.tryDecode`: the coding is neither gzip nor deflate, or the
 * window lies outside its buffer; nothing was decoded.
 */
export const HTTP_DECODE_BAD_CALL: i32 = -3

/** The first output buffer `HttpBodyDecoder` makes, when its limit allows that many bytes. */
const HTTP_DECODE_FIRST: i32 = 4096

/**
 * Decodes a request body sent with `Content-Encoding: gzip` or `deflate`
 * under a limit on what it decodes to, so a small body that inflates to
 * gigabytes (a decompression bomb) is refused once `limit` bytes are out,
 * having inflated fewer than three times `limit` bytes to find that out.
 * The decompressors are built once; `output` grows, doubling, to the
 * largest body decoded and is kept. Not shared between threads.
 *
 *     const d = new HttpBodyDecoder(1 << 20)
 *     const n: i32 = d.decode(HTTP_CODING_GZIP, body, 0, bodyLength) // d.output[0 .. n), or < 0
 */
export class HttpBodyDecoder {
  /** The most bytes a body may decode to; one more is `HTTP_DECODE_TOO_LARGE`. */
  readonly limit: i32
  /**
   * Where `decode` writes, from index 0. A caller may take the array and
   * leave another in its place, which `decode` then writes into, or grows
   * past.
   */
  output: u8[]
  private readonly gunzip: GzipDecompressor
  private readonly unzlib: ZlibDecompressor

  /**
   * A decoder that refuses a body decoding to more than `limit` bytes; a
   * `limit` under 1 panics.
   * @param limit the most bytes one body may decode to
   */
  constructor(limit: i32) {
    if (limit < 1) {
      panic(`HttpBodyDecoder: a limit of ${limit} is under 1`)
    }
    this.limit = limit
    this.output = []
    this.gunzip = new GzipDecompressor()
    this.unzlib = new ZlibDecompressor()
  }

  /**
   * Decodes `src[off .. off + len)`, one body in `coding`, into `output`
   * from index 0. Another coding than `HTTP_CODING_GZIP` or
   * `HTTP_CODING_DEFLATE`, or a window outside `src`, panics; `tryDecode`
   * answers `HTTP_DECODE_BAD_CALL` instead.
   * @param coding `HTTP_CODING_GZIP` (one gzip member or several) or `HTTP_CODING_DEFLATE` (a zlib stream)
   * @param src the array that holds the encoded body
   * @param off where the body starts in `src`
   * @param len how many bytes the body is; every one must belong to the stream
   * @returns how many bytes the body decoded to, `output[0 .. result)`;
   *   `HTTP_DECODE_TOO_LARGE` past `limit`; or `HTTP_DECODE_MALFORMED` for
   *   a stream that is cut short, fails its check or has bytes after it.
   *   After a refusal `output` means nothing.
   */
  decode(coding: i32, src: u8[], off: i32, len: i32): i32 {
    if (coding !== HTTP_CODING_GZIP && coding !== HTTP_CODING_DEFLATE) {
      panic(`HttpBodyDecoder.decode: coding ${coding} is neither gzip nor deflate`)
    }
    const end: i32 = this.tryDecode(coding, src, off, len)
    if (end === HTTP_DECODE_BAD_CALL) {
      panic("HttpBodyDecoder.decode: the window lies outside its buffer")
    }
    return end
  }

  /**
   * `decode` that answers `HTTP_DECODE_BAD_CALL`, decoding nothing, where
   * `decode` panics: a coding other than `HTTP_CODING_GZIP` or
   * `HTTP_CODING_DEFLATE`, or a window outside `src`. The coding often comes
   * from a request's `Content-Encoding` (`httpContentEncoding`), so a caller
   * that passes it on unchecked uses this one.
   * @param coding `HTTP_CODING_GZIP` (one gzip member or several) or `HTTP_CODING_DEFLATE` (a zlib stream)
   * @param src the array that holds the encoded body
   * @param off where the body starts in `src`
   * @param len how many bytes the body is; every one must belong to the stream
   * @returns what `decode` answers, or `HTTP_DECODE_BAD_CALL`
   */
  tryDecode(coding: i32, src: u8[], off: i32, len: i32): i32 {
    if (coding !== HTTP_CODING_GZIP && coding !== HTTP_CODING_DEFLATE) {
      return HTTP_DECODE_BAD_CALL
    }
    if (off < 0 || len < 0 || off > toI32(src.length) - len) {
      return HTTP_DECODE_BAD_CALL
    }
    const limit: i32 = this.limit
    // A first guess of four times the input, so most bodies decode at once.
    // Under the test, `len` is at most a quarter of `limit`, so four times it
    // is an `i32` and the unsigned product is the same.
    let size: i32 = len > limit >> 2 ? limit : toI32(toU32(len) * 4)
    if (size < HTTP_DECODE_FIRST) {
      size = limit < HTTP_DECODE_FIRST ? limit : HTTP_DECODE_FIRST
    }
    while (true) {
      // Grown in place rather than made anew: a length the compiler cannot
      // see is not negative would cost `new Array` a check. The bytes kept
      // mean nothing, since each decode writes from the start. No
      // bench/instructions.json row gets here: pg-carrier's HttpHandler owns a
      // decoder but sends no Content-Encoding.
      const output: u8[] = this.output
      while (toI32(output.length) < size) {
        output.push(0)
      }
      const end: i32 =
        coding === HTTP_CODING_GZIP
          ? this.gunzip.decompress(src, off, len, this.output, toI32(0), limit)
          : this.unzlib.decompress(src, off, len, this.output, toI32(0), limit)
      if (end >= 0) {
        return end
      }
      if (end !== DEFLATE_ERR_OUTPUT_LIMIT) {
        return HTTP_DECODE_MALFORMED
      }
      const have: i32 = toI32(this.output.length)
      if (have >= limit) {
        return HTTP_DECODE_TOO_LARGE
      }
      // Under the test, `have` is at most half of `limit`, so twice it is an
      // `i32` and the unsigned product is the same.
      size = have > limit >> 1 ? limit : toI32(toU32(have) * 2)
    }
  }
}
