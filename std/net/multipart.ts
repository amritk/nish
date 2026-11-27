/**
 * `nish/net/multipart` — a `multipart/form-data` body read part by part, as
 * an HTML form with a file input sends it (RFC 7578, framed by RFC 2046
 * §5.1.1). It reads a body the program already holds, such as
 * `HttpServerRequest.body`, and copies no part's data: each part answers
 * where its data sits in that body.
 *
 *     import { mediaTypeParse, mediaTypeParam } from "nish/net/http-fields";
 *     import { MultipartLimits, MultipartReader, MULTIPART_PART } from "nish/net/multipart";
 *
 *     const type = mediaTypeParse(contentType, 0, toI32(contentType.length));
 *     const boundary = type === null ? null : mediaTypeParam(type, "boundary");
 *     if (boundary !== null) {
 *       const parts = new MultipartReader(req.body, req.bodyLength, boundary, new MultipartLimits());
 *       while (parts.next() === MULTIPART_PART) {
 *         // parts.name, parts.filename, parts.contentType,
 *         // req.body[parts.dataStart .. parts.dataStart + parts.dataLength)
 *       }
 *     }
 *
 * **The framing.** A delimiter is CR LF, `--` and the boundary; the first may
 * open the body with no CR LF before it. After an opening delimiter come
 * optional spaces and tabs (RFC 2046's transport padding) and CR LF, then the
 * part's header lines, an empty line and its data, which runs to the next
 * delimiter. The close delimiter is a delimiter followed by `--`. What comes
 * before the first delimiter (the preamble) and after the close one (the
 * epilogue) is skipped. A run of `CR LF -- boundary` followed by anything
 * else is data, not a delimiter, so a sender that picks a boundary its data
 * holds still frames each part where it meant to.
 *
 * **What it refuses**, each with its own code, and once refused it answers
 * that code from then on:
 *
 * - a boundary that is empty, longer than 70 octets, holds an octet outside
 *   RFC 2046's `bchars` or ends in a space (`MULTIPART_ERR_BOUNDARY`);
 * - a body length below 0 or past the array (`MULTIPART_ERR_WINDOW`);
 * - a body with no opening delimiter, a part whose header lines or data run
 *   to the end of the body, and so a body with no close delimiter
 *   (`MULTIPART_ERR_UNTERMINATED`);
 * - a header line that ends in a CR or LF alone, starts with a space or tab
 *   (an obsolete folded line), has no colon, or whose name or value
 *   `httpFieldNameValid` or `httpFieldValueValid` refuses, and a
 *   `Content-Type` given twice or that `mediaTypeParse` refuses
 *   (`MULTIPART_ERR_HEADER`);
 * - more header lines in one part than `maxHeaders`, or more octets of them
 *   than `maxHeaderBytes` (`MULTIPART_ERR_HEADERS`);
 * - a part with no `Content-Disposition`, two of them, one that
 *   `formDataDispositionParse` refuses, one that is not `form-data` or one
 *   with no `name` parameter (`MULTIPART_ERR_DISPOSITION`);
 * - more parts than `maxParts` (`MULTIPART_ERR_PARTS`).
 *
 * The `filename` parameter is read as given: a browser writes a `"`, CR or LF
 * in it as `%22`, `%0D` or `%0A`, and those stay as they are. `filename*` is
 * not read (RFC 7578 §4.2). A part's own `Content-Transfer-Encoding` is not
 * applied (§4.7), and nothing is written to disk.
 *
 * **What it costs.** Finding a delimiter compares at most the boundary's
 * length plus six octets at each CR of the body, and reads each run of
 * transport padding once; a part's header lines are at most
 * `maxHeaderBytes` octets, each read a fixed number of times, and each
 * holds at most 16 parameters. So a body of `n` octets and a boundary of
 * `b` costs about `n * (b + 6)` comparisons at most, however it is shaped.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 *
 * Written from RFC 7578, RFC 2046 §5.1 and the HTML form submission
 * algorithm, not ported from another implementation.
 */
import {
  formDataDispositionParse,
  httpFieldIs,
  httpFieldNameValid,
  httpFieldValueValid,
  MediaType,
  mediaTypeParam,
  mediaTypeParse,
} from "nish/net/http-fields"

/** `MultipartReader.next`: another part was read; its fields describe it. */
export const MULTIPART_PART: i32 = 1

/** `MultipartReader.next`: the close delimiter was read; no part follows. */
export const MULTIPART_END: i32 = 0

/** The boundary is empty, longer than 70 octets, holds a non-`bchars` octet or ends in a space. */
export const MULTIPART_ERR_BOUNDARY: i32 = -1

/** The body has no opening delimiter, or ends inside a part's header lines or data. */
export const MULTIPART_ERR_UNTERMINATED: i32 = -2

/** A part's header line is malformed, or its `Content-Type` is repeated or malformed. */
export const MULTIPART_ERR_HEADER: i32 = -3

/** A part has more header lines than `maxHeaders` or more octets of them than `maxHeaderBytes`. */
export const MULTIPART_ERR_HEADERS: i32 = -4

/** A part's `Content-Disposition` is absent, repeated, not `form-data` or has no `name`. */
export const MULTIPART_ERR_DISPOSITION: i32 = -5

/** The body holds more parts than `maxParts`. */
export const MULTIPART_ERR_PARTS: i32 = -6

/** The body length given is below 0 or past the end of the array. */
export const MULTIPART_ERR_WINDOW: i32 = -7

/** The longest boundary RFC 2046 §5.1.1 allows. */
const MULTIPART_BOUNDARY_MAX: i32 = 70

/** `MultipartReader.kind`: the last delimiter found is not one. */
const MULTIPART_NONE: i32 = 0

/** `MultipartReader.kind`: the last delimiter found opens a part. */
const MULTIPART_OPEN: i32 = 1

/** `MultipartReader.kind`: the last delimiter found is the close delimiter. */
const MULTIPART_CLOSE: i32 = 2

/**
 * How much one body may make a `MultipartReader` read. The defaults hold a
 * browser's form with a few dozen fields; a server that takes larger forms
 * raises them.
 */
export class MultipartLimits {
  /** The most parts a body may hold; one more is `MULTIPART_ERR_PARTS`. */
  maxParts: i32 = 64
  /** The most octets of header lines one part may hold, each line's CR LF counted and the empty line not. */
  maxHeaderBytes: i32 = 8192
  /** The most header lines one part may hold; one more is `MULTIPART_ERR_HEADERS`. */
  maxHeaders: i32 = 16
}

/** Whether `c` is one of RFC 2046's `bchars`: a digit, a letter, `'()+_,-./:=?` or a space. */
const multipartBchar = (c: i32): boolean => {
  if ((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122)) {
    return true
  }
  switch (c) {
    case 32: // space
    case 39: // '
    case 40: // (
    case 41: // )
    case 43: // +
    case 44: // ,
    case 45: // -
    case 46: // .
    case 47: // /
    case 58: // :
    case 61: // =
    case 63: // ?
    case 95: // _
      return true
    default:
      return false
  }
}

/**
 * The octets in `bytes[from .. to)` as a string, a byte at a time because
 * `String.fromBytes` keeps a range check no proof removes; letters in
 * lowercase when `lower`.
 */
const multipartString = (bytes: readonly u8[], from: i32, to: i32, lower: boolean): string => {
  const parts: string[] = []
  let i: i32 = from
  while (i >= 0 && i < to && i < toI32(bytes.length)) {
    const c: i32 = toI32(bytes[i])
    parts.push(String.fromCharCode(lower && c >= 65 && c <= 90 ? c | 32 : c))
    i = i + 1
  }
  return parts.join("")
}

/** A copy of `bytes[from .. to)`, letters in lowercase when `lower`. */
const multipartCopy = (bytes: readonly u8[], from: i32, to: i32, lower: boolean): u8[] => {
  const out: u8[] = []
  let i: i32 = from
  while (i >= 0 && i < to && i < toI32(bytes.length)) {
    const c: i32 = toI32(bytes[i])
    out.push(lower && c >= 65 && c <= 90 ? toU8(c | 32) : toU8(c))
    i = i + 1
  }
  return out
}

/**
 * Reads a `multipart/form-data` body one part at a time. Each `next()` that
 * answers `MULTIPART_PART` sets `name`, `filename`, `contentType`,
 * `dataStart` and `dataLength` for that part; the body is read in place and
 * must not change while the reader is in use.
 */
export class MultipartReader {
  /** The part's `name` parameter of `Content-Disposition`, as given. */
  name: string = ""
  /** The part's `filename` parameter as given, `""` when given empty, or null when absent. */
  filename: string | null = null
  /** The part's `Content-Type` value as given, or `text/plain` when it has none (RFC 7578 §4.4). */
  contentType: string = "text/plain"
  /** @internal The body the parts are read from. */
  body: readonly u8[] = []
  /** @internal CR LF, `--` and the boundary: what each delimiter starts with. */
  delimiter: u8[] = []
  /** Where the part's data starts in the body. */
  dataStart: i32 = 0
  /** How many octets of data the part holds. */
  dataLength: i32 = 0
  /** @internal How many octets of `body` are the message's. */
  length: i32 = 0
  /** @internal The most header lines one part may hold. */
  maxHeaders: i32 = 0
  /** @internal The most octets of header lines one part may hold. */
  maxHeaderBytes: i32 = 0
  /** @internal What the last delimiter found is: `MULTIPART_OPEN` or `MULTIPART_CLOSE`. */
  kind: i32 = 0
  /** @internal Where the octets after the last opening delimiter's line start. */
  after: i32 = 0
  /** @internal How many more parts `next` may answer. */
  partsLeft: i32 = 0
  /** @internal The code every later `next` answers, once one is refused or the body ends; 1 while reading. */
  sticky: i32 = 1
  /** @internal Whether the opening delimiter has been looked for. */
  started: boolean = false

  /**
   * A reader over `body[0 .. length)`. A boundary or length it refuses is
   * not reported here: the first `next()` answers it.
   *
   * @param body the octets of the message body
   * @param length how many octets of `body` the body is, such as a request's
   *   `bodyLength`
   * @param boundary the `boundary` parameter of the request's `Content-Type`,
   *   as `mediaTypeParam` answers it
   * @param limits how many parts, header lines and header octets to read
   */
  constructor(body: readonly u8[], length: i32, boundary: string, limits: MultipartLimits) {
    this.body = body
    this.partsLeft = limits.maxParts
    this.maxHeaders = limits.maxHeaders
    this.maxHeaderBytes = limits.maxHeaderBytes
    const b: i32 = toI32(boundary.length)
    if (length < 0 || length > toI32(body.length)) {
      this.sticky = MULTIPART_ERR_WINDOW
      return
    }
    this.length = length
    if (b < 1 || b > MULTIPART_BOUNDARY_MAX || toI32(boundary.charCodeAt(b - 1)) === 32) {
      this.sticky = MULTIPART_ERR_BOUNDARY
      return
    }
    const delimiter: u8[] = [13, 10, 45, 45]
    for (let k: i32 = 0; k < b; k++) {
      const c: i32 = toI32(boundary.charCodeAt(k))
      if (!multipartBchar(c)) {
        this.sticky = MULTIPART_ERR_BOUNDARY
        return
      }
      delimiter.push(toU8(c))
    }
    this.delimiter = delimiter
  }

  /**
   * Reads the next part.
   *
   * @returns `MULTIPART_PART` when a part was read, its fields now
   *   describing it; `MULTIPART_END` once the close delimiter is read, and
   *   from then on; or a negative `MULTIPART_ERR_*` code, which every later
   *   call answers too
   */
  next(): i32 {
    if (this.sticky !== MULTIPART_PART) {
      return this.sticky
    }
    if (!this.started) {
      this.started = true
      // The first delimiter may open the body, with no CR LF before it.
      this.kind = this.delimiterAt(toI32(0), toI32(2))
      if (this.kind === MULTIPART_NONE && this.find(toI32(0)) < 0) {
        return this.fail(MULTIPART_ERR_UNTERMINATED)
      }
    }
    if (this.kind === MULTIPART_CLOSE) {
      return this.fail(MULTIPART_END)
    }
    const left: i32 = this.partsLeft
    if (left <= 0) {
      return this.fail(MULTIPART_ERR_PARTS)
    }
    const read: i32 = this.readHeaders(this.after)
    if (read !== MULTIPART_PART) {
      return this.fail(read)
    }
    const start: i32 = this.dataStart
    const end: i32 = this.find(start)
    if (start < 0 || end < start) {
      return this.fail(MULTIPART_ERR_UNTERMINATED)
    }
    this.dataLength = end - start
    this.partsLeft = left - 1
    return MULTIPART_PART
  }

  /** @internal Records `code` as what every later `next` answers, and answers it. */
  fail(code: i32): i32 {
    this.sticky = code
    this.dataStart = 0
    this.dataLength = 0
    return code
  }

  /**
   * @internal Whether `body[at ..]` holds `delimiter[skip ..]` followed by
   * `--` (`MULTIPART_CLOSE`) or by spaces and tabs and CR LF
   * (`MULTIPART_OPEN`, `after` set past the LF); `MULTIPART_NONE` otherwise.
   */
  delimiterAt(at: i32, skip: i32): i32 {
    const body: readonly u8[] = this.body
    const delimiter: u8[] = this.delimiter
    const length: i32 = this.length
    let i: i32 = at
    let k: i32 = skip
    while (k >= 0 && k < toI32(delimiter.length)) {
      if (i < 0 || i >= length || i >= toI32(body.length) || body[i] !== delimiter[k]) {
        return MULTIPART_NONE
      }
      i = i + 1
      k = k + 1
    }
    if (i >= 0 && i < length && i < toI32(body.length) && toI32(body[i]) === 45) {
      const j: i32 = i + 1
      return j < length && j < toI32(body.length) && toI32(body[j]) === 45 ? MULTIPART_CLOSE : MULTIPART_NONE
    }
    while (
      i >= 0 &&
      i < length &&
      i < toI32(body.length) &&
      (toI32(body[i]) === 32 || toI32(body[i]) === 9)
    ) {
      i = i + 1
    }
    if (i < 0 || i >= length || i >= toI32(body.length) || toI32(body[i]) !== 13) {
      return MULTIPART_NONE
    }
    const lf: i32 = i + 1
    if (lf >= length || lf >= toI32(body.length) || toI32(body[lf]) !== 10) {
      return MULTIPART_NONE
    }
    this.after = lf + 1
    return MULTIPART_OPEN
  }

  /**
   * @internal The first index from `from` where a delimiter starts, its kind
   * in `kind`; -1 when the body holds none.
   */
  find(from: i32): i32 {
    const body: readonly u8[] = this.body
    const length: i32 = this.length
    let p: i32 = from
    while (p >= 0 && p < length && p < toI32(body.length)) {
      if (toI32(body[p]) === 13) {
        const kind: i32 = this.delimiterAt(p, toI32(0))
        if (kind !== MULTIPART_NONE) {
          this.kind = kind
          return p
        }
      }
      p = p + 1
    }
    return -1
  }

  /**
   * @internal Reads the header lines that start at `at` and the empty line
   * after them, setting `name`, `filename`, `contentType` and `dataStart`.
   * Answers `MULTIPART_PART` or the code that refuses them.
   */
  readHeaders(at: i32): i32 {
    const body: readonly u8[] = this.body
    const length: i32 = this.length
    this.name = ""
    this.filename = null
    this.contentType = "text/plain"
    let disposition: boolean = false
    let typed: boolean = false
    // What the caps leave, counted down so that no sum can wrap.
    let linesLeft: i32 = this.maxHeaders
    let room: i32 = this.maxHeaderBytes
    let i: i32 = at
    while (i >= 0 && i < length && i < toI32(body.length)) {
      // The line runs to the first CR or LF, each octet of it counted.
      let e: i32 = i
      while (
        e >= 0 &&
        e < length &&
        e < toI32(body.length) &&
        toI32(body[e]) !== 13 &&
        toI32(body[e]) !== 10
      ) {
        if (room <= 0) {
          return MULTIPART_ERR_HEADERS
        }
        room = room - 1
        e = e + 1
      }
      if (e < 0 || e >= length || e >= toI32(body.length)) {
        return MULTIPART_ERR_UNTERMINATED
      }
      const lf: i32 = e + 1
      if (toI32(body[e]) !== 13) {
        return MULTIPART_ERR_HEADER
      }
      // A body cut after the CR has not said what comes next.
      if (lf >= length || lf >= toI32(body.length)) {
        return MULTIPART_ERR_UNTERMINATED
      }
      if (toI32(body[lf]) !== 10) {
        return MULTIPART_ERR_HEADER
      }
      if (e === i) {
        if (!disposition) {
          return MULTIPART_ERR_DISPOSITION
        }
        this.dataStart = lf + 1
        return MULTIPART_PART
      }
      if (linesLeft <= 0 || room < 2) {
        return MULTIPART_ERR_HEADERS
      }
      linesLeft = linesLeft - 1
      room = room - 2
      const line: i32 = this.readHeader(i, e, disposition, typed)
      if (line < 0) {
        return line
      }
      disposition = disposition || line === 1
      typed = typed || line === 2
      i = lf + 1
    }
    return MULTIPART_ERR_UNTERMINATED
  }

  /**
   * @internal Reads the header line `body[from .. to)`, which holds no CR or
   * LF. Answers 1 for a `Content-Disposition`, 2 for a `Content-Type`, 0 for
   * another field, or the code that refuses it.
   */
  readHeader(from: i32, to: i32, disposition: boolean, typed: boolean): i32 {
    const body: readonly u8[] = this.body
    if (from < 0 || from >= to || from >= toI32(body.length)) {
      return MULTIPART_ERR_HEADER
    }
    // An obsolete folded line starts with a space or tab, so the name before
    // its colon is not a token and `httpFieldNameValid` refuses it below.
    let colon: i32 = from
    while (colon >= 0 && colon < to && colon < toI32(body.length) && toI32(body[colon]) !== 58) {
      colon = colon + 1
    }
    if (colon >= to) {
      return MULTIPART_ERR_HEADER
    }
    const name: u8[] = multipartCopy(body, from, colon, true)
    // A value's optional whitespace at either end is not part of it.
    let vs: i32 = colon + 1
    while (
      vs >= 0 &&
      vs < to &&
      vs < toI32(body.length) &&
      (toI32(body[vs]) === 32 || toI32(body[vs]) === 9)
    ) {
      vs = vs + 1
    }
    let ve: i32 = to
    let trimming: boolean = true
    while (trimming && ve > 0 && ve > vs) {
      const k: i32 = ve - 1
      trimming = k >= 0 && k < toI32(body.length) && (toI32(body[k]) === 32 || toI32(body[k]) === 9)
      if (trimming) {
        ve = k
      }
    }
    if (!httpFieldNameValid(name) || !httpFieldValueValid(multipartCopy(body, vs, ve, false))) {
      return MULTIPART_ERR_HEADER
    }
    if (httpFieldIs(name, "content-disposition")) {
      const d: MediaType | null = disposition ? null : formDataDispositionParse(body, vs, ve)
      if (d === null || d.type !== "form-data") {
        return MULTIPART_ERR_DISPOSITION
      }
      const field: string | null = mediaTypeParam(d, "name")
      if (field === null) {
        return MULTIPART_ERR_DISPOSITION
      }
      this.name = field
      this.filename = mediaTypeParam(d, "filename")
      return 1
    }
    if (httpFieldIs(name, "content-type")) {
      if (typed || mediaTypeParse(body, vs, ve) === null) {
        return MULTIPART_ERR_HEADER
      }
      this.contentType = multipartString(body, vs, ve, false)
      return 2
    }
    return 0
  }
}
