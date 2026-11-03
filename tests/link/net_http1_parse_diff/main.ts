// The HTTP/1.1 request parser against main's, frozen in ./old.ts: both parsers
// are fed the same bytes in the same pieces, and after every event they must
// agree on the event and on everything a caller can read (the status and
// reason, the method, target, version and every field, as strings and as
// spans into `head`, the content length, keep-alive, the upgrade, the body
// windows and the bytes past an upgrade). docs/security/http1-codec.md cites
// this as the proof that a change to the parser's speed changed nothing else.
//
// The inputs are the fuzz corpus and regressions (tests/fuzz/corpus/http1 and
// tests/fuzz/regressions/http1, read with their own settings and then cut
// every way below), requests a seeded grammar makes (methods, targets,
// versions, the framing fields, OWS, obs-fold, bare CR and LF, control and
// high-bit bytes, bodies, pipelining), every byte 0 to 255 at every position
// of three requests, nine bytes inserted at every position, each limit at -1,
// 0 and +1, every two-feed split point, byte-at-a-time feeding and pipelined
// pairs.
//
// HTTP1_DIFF_SEED and HTTP1_DIFF_CASES set the grammar's seed and how many
// requests it makes, for a soak; the defaults make 10^5 grammar requests and
// the summary expected.out holds. A disagreement prints the case and its
// bytes on stderr and exits 1.
import {
  HTTP1_BODY,
  HTTP1_CLOSED,
  HTTP1_END,
  HTTP1_ERROR,
  HTTP1_HEAD,
  HTTP1_MAX_METHOD,
  HTTP1_NEED_MORE,
  HTTP1_UPGRADE,
  Http1Parser,
} from "nish/net/http1-codec"
import { Region, enter, enterWith, free, regionWith } from "nish:region"
import { H1OLD_MAX_METHOD, H1oldParser } from "./old"

/** One way of building and feeding the two parsers. */
class Setup {
  maxTarget: i32 = 8192
  maxHeaderBytes: i32 = 16384
  maxHeaders: i32 = 100
  maxBody: i32 = 1048576
  keepText: boolean = true
  /** `maxChunk`, or 0 to leave the parser's own. */
  maxChunk: i32 = 0
  /** Whether an upgrade is declined, so the bytes after it are the next request. */
  decline: boolean = false
  /** Whether each piece is fed as an array of its own instead of a window. */
  fresh: boolean = false
  /** The piece sizes, used in turn; 0 takes the rest, and none feeds it whole. */
  cuts: i32[]
  constructor() {
    this.cuts = []
  }
}

/** A copy of `s`, in memory the caller allocates. */
const setupCopy = (s: Setup): Setup => {
  const c = new Setup()
  c.maxTarget = s.maxTarget
  c.maxHeaderBytes = s.maxHeaderBytes
  c.maxHeaders = s.maxHeaders
  c.maxBody = s.maxBody
  c.keepText = s.keepText
  c.maxChunk = s.maxChunk
  c.decline = s.decline
  c.fresh = s.fresh
  for (let k: i32 = 0; k < toI32(s.cuts.length); k++) {
    c.cuts.push(s.cuts[k])
  }
  return c
}

/** The settings byte the fuzz target reads (tests/fuzz/targets/http1.ts). */
const setupOf = (config: i32): Setup => {
  const s = new Setup()
  if (config % 2 === 1) {
    s.maxTarget = 16
    s.maxHeaderBytes = 64
    s.maxHeaders = 4
    s.maxBody = 32
  }
  s.keepText = (config / 2) % 2 === 0
  const chunk: i32 = (config / 4) % 4
  if (chunk === 1) {
    s.maxChunk = 1
  } else if (chunk === 2) {
    s.maxChunk = 3
  } else if (chunk === 3) {
    s.maxChunk = 16
  }
  s.decline = (config / 16) % 2 === 1
  s.fresh = (config / 32) % 2 === 1
  return s
}

/** A seeded xorshift32: the same seed draws the same cases on every machine. */
class Rng {
  x: u32 = 2463534242
  next(): u32 {
    let x: u32 = this.x
    x = x ^ (x << 13)
    x = x ^ (x >>> 17)
    x = x ^ (x << 5)
    this.x = x
    return x
  }
  /** A draw in [0, n), n > 0. */
  below(n: i32): i32 {
    return toI32(this.next() % toU32(n))
  }
  /** True one time in `n`. */
  oneIn(n: i32): boolean {
    return this.below(n) === 0
  }
}

/** What the run has seen, for the summary and the disagreement report. */
class Tally {
  cases: i32 = 0
  events: i32 = 0
  heads: i32 = 0
  bodies: i32 = 0
  ends: i32 = 0
  upgrades: i32 = 0
  closes: i32 = 0
  errors: i32 = 0
  /** Refusals by status: 400, 413, 414, 431, 501, 505 and any other. */
  s400: i32 = 0
  s413: i32 = 0
  s414: i32 = 0
  s431: i32 = 0
  s501: i32 = 0
  s505: i32 = 0
  sOther: i32 = 0
  /** Every state hash in order, folded: the run's fingerprint. */
  print: u32 = 2166136261
  failed: boolean = false
  label: string = ""
}

/** One step of FNV-1a over a whole `i32`. */
const mix = (sum: u32, x: i32): u32 => (sum ^ toU32(x)) * 16777619

const mixBool = (sum: u32, b: boolean): u32 => mix(sum, b ? 1 : 0)

const mixText = (sum0: u32, text: string): u32 => {
  let sum: u32 = mix(sum0, toI32(text.length))
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    sum = mix(sum, text.charCodeAt(i))
  }
  return sum
}

const mixBytes = (sum0: u32, xs: u8[], from: i32, to: i32): u32 => {
  let sum: u32 = mix(sum0, to - from)
  for (let i: i32 = from; i < to && i >= 0 && i < toI32(xs.length); i++) {
    sum = mix(sum, toI32(xs[i]))
  }
  return sum
}

const mixMaybe = (sum: u32, text: string | null): u32 => (text === null ? mix(sum, -1) : mixText(sum, text))

/**
 * Everything a caller can read of `p` after the event `e`. The new parser and
 * the old have the same fields under the same names, and this and `stateOld`
 * read them in the same order.
 */
const stateNew = (p: Http1Parser, e: i32): u32 => {
  let sum: u32 = mix(2166136261, e)
  sum = mix(sum, p.status)
  sum = mix(sum, p.buffered())
  sum = mixBool(sum, p.resting())
  if (e === HTTP1_HEAD) {
    sum = mix(sum, p.minor)
    sum = mix(sum, p.contentLength)
    sum = mixBool(sum, p.keepAlive)
    sum = mixBool(sum, p.upgrading)
    sum = mixBool(sum, p.chunked)
    sum = mix(sum, p.methodStart)
    sum = mix(sum, p.methodEnd)
    sum = mix(sum, p.targetStart)
    sum = mix(sum, p.targetEnd)
    sum = mix(sum, p.headerCount)
    sum = mix(sum, p.headLength)
    for (let k: i32 = 0; k < 4 * p.headerCount && k < toI32(p.spans.length); k++) {
      sum = mix(sum, p.spans[k])
    }
    sum = mixBytes(sum, p.head, 0, p.headLength)
    sum = mixBool(sum, p.methodIs("GET"))
    sum = mixBool(sum, p.targetIs("/"))
    sum = mixBool(sum, p.upgradeIs("websocket"))
    sum = mixBool(sum, p.headerIs("connection", "close"))
    sum = mix(sum, p.headerIndex("content-length"))
    sum = mixMaybe(sum, p.header("host"))
    if (p.keepText) {
      sum = mixText(sum, p.method)
      sum = mixText(sum, p.target)
      sum = mixText(sum, p.upgrade)
      sum = mix(sum, toI32(p.names.length))
      sum = mix(sum, toI32(p.values.length))
      for (let i: i32 = 0; i < toI32(p.names.length); i++) {
        sum = mixText(sum, p.names[i])
      }
      for (let i: i32 = 0; i < toI32(p.values.length); i++) {
        sum = mixText(sum, p.values[i])
      }
    }
  } else if (e === HTTP1_BODY) {
    sum = mix(sum, p.bodyOff)
    sum = mixBytes(sum, p.body, p.bodyOff, p.bodyOff + p.bodyLen)
  } else if (e === HTTP1_ERROR) {
    sum = mixText(sum, p.reason)
  } else if (e === HTTP1_UPGRADE) {
    const rest: u8[] = p.upgradeBytes()
    sum = mixBytes(sum, rest, 0, toI32(rest.length))
  }
  return sum
}

const stateOld = (p: H1oldParser, e: i32): u32 => {
  let sum: u32 = mix(2166136261, e)
  sum = mix(sum, p.status)
  sum = mix(sum, p.buffered())
  sum = mixBool(sum, p.resting())
  if (e === HTTP1_HEAD) {
    sum = mix(sum, p.minor)
    sum = mix(sum, p.contentLength)
    sum = mixBool(sum, p.keepAlive)
    sum = mixBool(sum, p.upgrading)
    sum = mixBool(sum, p.chunked)
    sum = mix(sum, p.methodStart)
    sum = mix(sum, p.methodEnd)
    sum = mix(sum, p.targetStart)
    sum = mix(sum, p.targetEnd)
    sum = mix(sum, p.headerCount)
    sum = mix(sum, p.headLength)
    for (let k: i32 = 0; k < 4 * p.headerCount && k < toI32(p.spans.length); k++) {
      sum = mix(sum, p.spans[k])
    }
    sum = mixBytes(sum, p.head, 0, p.headLength)
    sum = mixBool(sum, p.methodIs("GET"))
    sum = mixBool(sum, p.targetIs("/"))
    sum = mixBool(sum, p.upgradeIs("websocket"))
    sum = mixBool(sum, p.headerIs("connection", "close"))
    sum = mix(sum, p.headerIndex("content-length"))
    sum = mixMaybe(sum, p.header("host"))
    if (p.keepText) {
      sum = mixText(sum, p.method)
      sum = mixText(sum, p.target)
      sum = mixText(sum, p.upgrade)
      sum = mix(sum, toI32(p.names.length))
      sum = mix(sum, toI32(p.values.length))
      for (let i: i32 = 0; i < toI32(p.names.length); i++) {
        sum = mixText(sum, p.names[i])
      }
      for (let i: i32 = 0; i < toI32(p.values.length); i++) {
        sum = mixText(sum, p.values[i])
      }
    }
  } else if (e === HTTP1_BODY) {
    sum = mix(sum, p.bodyOff)
    sum = mixBytes(sum, p.body, p.bodyOff, p.bodyOff + p.bodyLen)
  } else if (e === HTTP1_ERROR) {
    sum = mixText(sum, p.reason)
  } else if (e === HTTP1_UPGRADE) {
    const rest: u8[] = p.upgradeBytes()
    sum = mixBytes(sum, rest, 0, toI32(rest.length))
  }
  return sum
}

const makeNew = (s: Setup): Http1Parser => {
  const p = new Http1Parser(s.maxTarget, s.maxHeaderBytes, s.maxHeaders, s.maxBody)
  p.keepText = s.keepText
  if (s.maxChunk > 0) {
    p.maxChunk = s.maxChunk
  }
  return p
}

const makeOld = (s: Setup): H1oldParser => {
  const p = new H1oldParser(s.maxTarget, s.maxHeaderBytes, s.maxHeaders, s.maxBody)
  p.keepText = s.keepText
  if (s.maxChunk > 0) {
    p.maxChunk = s.maxChunk
  }
  return p
}

const hexOf = (xs: u8[]): string => {
  const digits: string = "0123456789abcdef"
  const parts: string[] = []
  for (let i: i32 = 0; i < toI32(xs.length); i++) {
    const b: i32 = toI32(xs[i])
    parts.push(digits.slice(b >> 4, (b >> 4) + 1) + digits.slice(b & 15, (b & 15) + 1))
  }
  return parts.join("")
}

const describe = (s: Setup): string => {
  const parts: string[] = []
  for (let i: i32 = 0; i < toI32(s.cuts.length); i++) {
    parts.push(`${s.cuts[i]}`)
  }
  return (
    `limits ${s.maxTarget}/${s.maxHeaderBytes}/${s.maxHeaders}/${s.maxBody} keepText ${s.keepText} ` +
    `maxChunk ${s.maxChunk} decline ${s.decline} fresh ${s.fresh} cuts [${parts.join(",")}]`
  )
}

const countEvent = (tally: Tally, e: i32, status: i32): void => {
  tally.events += 1
  if (e === HTTP1_HEAD) {
    tally.heads += 1
  } else if (e === HTTP1_BODY) {
    tally.bodies += 1
  } else if (e === HTTP1_END) {
    tally.ends += 1
  } else if (e === HTTP1_UPGRADE) {
    tally.upgrades += 1
  } else if (e === HTTP1_CLOSED) {
    tally.closes += 1
  } else if (e === HTTP1_ERROR) {
    tally.errors += 1
    if (status === 400) {
      tally.s400 += 1
    } else if (status === 413) {
      tally.s413 += 1
    } else if (status === 414) {
      tally.s414 += 1
    } else if (status === 431) {
      tally.s431 += 1
    } else if (status === 501) {
      tally.s501 += 1
    } else if (status === 505) {
      tally.s505 += 1
    } else {
      tally.sOther += 1
    }
  }
}

/** The first disagreement is reported in full; the run stops at it. */
const report = (cases: i32, s: Setup, input: u8[], step: i32, a: Http1Parser, b: H1oldParser, ea: i32, eb: i32): void => {
  writeError(`net_http1_parse_diff: case ${cases} disagrees at event ${step}\n`)
  writeError(`  setup: ${describe(s)}\n`)
  writeError(`  new: event ${ea} status ${a.status} reason "${a.reason}" buffered ${a.buffered()}\n`)
  writeError(`  old: event ${eb} status ${b.status} reason "${b.reason}" buffered ${b.buffered()}\n`)
  writeError(`  new head: ${a.methodStart}-${a.methodEnd} ${a.targetStart}-${a.targetEnd} fields ${a.headerCount}\n`)
  writeError(`  old head: ${b.methodStart}-${b.methodEnd} ${b.targetStart}-${b.targetEnd} fields ${b.headerCount}\n`)
  writeError(`  input (${toI32(input.length)} bytes): ${hexOf(input)}\n`)
}

/**
 * Feeds `input` to `a` and `b`, built alike by `s`, pulls the next event from
 * each in lockstep after every piece, and compares them. Answers whether they
 * agreed on everything; the first disagreement is reported.
 */
const runParsers = (tally: Tally, s: Setup, input: u8[], a: Http1Parser, b: H1oldParser): boolean => {
  const n: i32 = toI32(input.length)
  let at: i32 = 0
  let piece: i32 = 0
  let step: i32 = 0
  const ncuts: i32 = toI32(s.cuts.length)
  while (at < n) {
    let take: i32 = n - at
    if (ncuts > 0) {
      const size: i32 = s.cuts[piece % ncuts]
      if (size > 0 && size < take) {
        take = size
      }
    }
    piece += 1
    if (s.fresh) {
      const own: u8[] = new Array<u8>(take)
      for (let k: i32 = 0; k < take && k < toI32(own.length) && at + k < n; k++) {
        own[k] = input[at + k]
      }
      a.feed(own, 0, take)
      b.feed(own, 0, take)
    } else {
      a.feed(input, at, take)
      b.feed(input, at, take)
    }
    at += take
    for (;;) {
      const ea: i32 = a.next()
      const eb: i32 = b.next()
      step += 1
      if (ea !== eb) {
        report(tally.cases, s, input, step, a, b, ea, eb)
        tally.failed = true
        return false
      }
      const ha: u32 = stateNew(a, ea)
      const hb: u32 = stateOld(b, eb)
      if (ha !== hb) {
        report(tally.cases, s, input, step, a, b, ea, eb)
        tally.failed = true
        return false
      }
      countEvent(tally, ea, a.status)
      tally.print = (tally.print ^ ha) * 16777619
      if (ea === HTTP1_NEED_MORE) {
        break
      }
      if (ea === HTTP1_UPGRADE) {
        if (!s.decline) {
          return true
        }
        a.declineUpgrade()
        b.declineUpgrade()
      } else if (ea === HTTP1_CLOSED || ea === HTTP1_ERROR) {
        return true
      }
    }
  }
  return true
}

/**
 * A case's two parsers and its own tally: a region's root, freed when the case
 * ends. The region rules summarise a function, not a call, so nothing outside
 * the region is handed in but numbers and what is only read; the counts are
 * copied out by `mergeOut`.
 */
class Pair {
  t: Tally
  s: Setup
  a: Http1Parser
  b: H1oldParser
  constructor(s: Setup) {
    this.t = new Tally()
    this.s = setupCopy(s)
    this.a = makeNew(s)
    this.b = makeOld(s)
  }
}

const pairOf = (s: Setup): Pair => new Pair(s)

const runIn = (pair: Pair, outer: u8[]): boolean => {
  // The region rules summarise `runParsers` once for every caller, so it is
  // handed only region memory: the setup and the input are copies.
  const n: i32 = toI32(outer.length)
  const input: u8[] = new Array<u8>(n)
  for (let k: i32 = 0; k < n && k < toI32(input.length); k++) {
    input[k] = outer[k]
  }
  return runParsers(pair.t, pair.s, input, pair.a, pair.b)
}

/** `to` takes `from`'s counts, fingerprint and verdict; `from` ran after `to`'s cases. */
const mergeTally = (from: Tally, to: Tally): void => {
  to.events += from.events
  to.heads += from.heads
  to.bodies += from.bodies
  to.ends += from.ends
  to.upgrades += from.upgrades
  to.closes += from.closes
  to.errors += from.errors
  to.s400 += from.s400
  to.s413 += from.s413
  to.s414 += from.s414
  to.s431 += from.s431
  to.s501 += from.s501
  to.s505 += from.s505
  to.sOther += from.sOther
  to.print = from.print
  to.failed = to.failed || from.failed
}

const pairCases = (pair: Pair, cases: i32): i32 => {
  pair.t.cases = cases
  return cases
}

const pairPrint = (pair: Pair, print: u32): u32 => {
  pair.t.print = print
  return print
}

const pairOut = (pair: Pair, to: Tally): boolean => {
  mergeTally(pair.t, to)
  return to.failed
}

/**
 * Runs one case in a region of its own, so the parsers' buffers and strings go
 * back when it ends: 10^5 cases would otherwise hold gigabytes of arena.
 */
const run = (tally: Tally, s: Setup, input: u8[]): boolean => {
  if (tally.failed) {
    return false
  }
  tally.cases += 1
  const r: Region<Pair> = regionWith(s, pairOf)
  enterWith(r, tally.cases, pairCases)
  enterWith(r, tally.print, pairPrint)
  enterWith(r, input, runIn)
  enterWith(r, tally, pairOut)
  free(r)
  if (tally.failed) {
    writeError(`  section: ${tally.label}\n`)
  }
  return !tally.failed
}

/** `run` with every cut pattern the plan names: whole, every two-feed split, byte at a time. */
const runCut = (tally: Tally, base: Setup, input: u8[], splits: boolean): void => {
  base.cuts = []
  run(tally, base, input)
  base.cuts = [1]
  run(tally, base, input)
  if (splits) {
    const n: i32 = toI32(input.length)
    for (let k: i32 = 1; k < n; k++) {
      base.cuts = [k, 0]
      run(tally, base, input)
    }
  }
  base.cuts = []
}

/** A byte builder for requests. */
class Out {
  xs: u8[]
  constructor() {
    this.xs = []
  }
  text(t: string): Out {
    for (let i: i32 = 0; i < toI32(t.length); i++) {
      this.xs.push(toU8(t.charCodeAt(i) & 255))
    }
    return this
  }
  byte(b: i32): Out {
    this.xs.push(toU8(b & 255))
    return this
  }
  bytes(ys: u8[]): Out {
    for (let i: i32 = 0; i < toI32(ys.length); i++) {
      this.xs.push(ys[i])
    }
    return this
  }
}

const bytesOf = (t: string): u8[] => new Out().text(t).xs

/** The `|`-separated words of `list`. */
const wordsOf = (list: string): string[] => {
  const out: string[] = []
  let from: i32 = 0
  for (;;) {
    const bar: i32 = list.indexOf("|", from)
    if (bar < 0) {
      out.push(list.slice(from))
      return out
    }
    out.push(list.slice(from, bar))
    from = bar + 1
  }
}

/** `n` in lowercase hex, or uppercase when `upper`. */
const hexNumber = (n0: i32, upper: boolean): string => {
  const digits: string = upper ? "0123456789ABCDEF" : "0123456789abcdef"
  if (n0 === 0) {
    return "0"
  }
  let text: string = ""
  let n: i32 = n0
  while (n > 0) {
    text = digits.slice(n % 16, n % 16 + 1) + text
    n = n / 16
  }
  return text
}

/** `xs[from .. to)` as a fresh array. */
const sliceBytes = (xs: u8[], from: i32, to: i32): u8[] => {
  const out: u8[] = new Array<u8>(to - from)
  for (let i: i32 = 0; i < toI32(out.length) && from + i < toI32(xs.length); i++) {
    out[i] = xs[from + i]
  }
  return out
}

/** Whether `a` sorts before `b`, byte by byte. */
const before = (a: string, b: string): boolean => {
  const n: i32 = toI32(a.length) < toI32(b.length) ? toI32(a.length) : toI32(b.length)
  for (let i: i32 = 0; i < n; i++) {
    if (a.charCodeAt(i) !== b.charCodeAt(i)) {
      return a.charCodeAt(i) < b.charCodeAt(i)
    }
  }
  return toI32(a.length) < toI32(b.length)
}

const pick = (r: Rng, list: string): string => {
  const xs: string[] = wordsOf(list)
  return xs[r.below(toI32(xs.length))]
}

const TCHARS: string = "!#$%&'*+-.^_`|~0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

/** `n` token bytes, now and then with one byte that is not a token byte. */
const tokenOf = (r: Rng, out: Out, n: i32): void => {
  for (let i: i32 = 0; i < n; i++) {
    if (r.oneIn(60)) {
      out.byte(r.below(256))
    } else {
      out.byte(TCHARS.charCodeAt(r.below(toI32(TCHARS.length))))
    }
  }
}

/** `n` field-value bytes: visible ASCII and spaces, now and then HTAB, high-bit, DEL or a control. */
const valueOf = (r: Rng, out: Out, n: i32): void => {
  for (let i: i32 = 0; i < n; i++) {
    const roll: i32 = r.below(100)
    if (roll < 80) {
      out.byte(33 + r.below(94))
    } else if (roll < 88) {
      out.byte(32)
    } else if (roll < 91) {
      out.byte(9)
    } else if (roll < 96) {
      out.byte(128 + r.below(128))
    } else if (roll < 97) {
      out.byte(127)
    } else if (roll < 98) {
      out.byte(0)
    } else {
      out.byte(r.below(32))
    }
  }
}

const METHODS: string = "GET|GET|GET|POST|POST|PUT|HEAD|DELETE|OPTIONS|PATCH|CONNECT|TRACE|M-SEARCH|get|"
const TARGETS: string = "/|/|/api/items/42|/a/b?c=d&e=f|*|http://example.org/x|example.org:443|/%20%zz||/a b"
const VERSIONS: string = "HTTP/1.1|HTTP/1.1|HTTP/1.1|HTTP/1.0|HTTP/2.0|HTTP/1.x|http/1.1|HTTP/1.10|HTTP/1|HTTP/0.9|HTTP/3.1"
const NAMES: string = "Host|Content-Length|content-length|Transfer-Encoding|Connection|Upgrade|Accept|User-Agent|Cookie|X-Forwarded-For|Expect"
const LENGTHS: string = "0|1|5|10|00012|-1|abc|5, 5|5,5|99999999999| 7 |"
const ENCODINGS: string = "chunked|chunked|gzip, chunked|chunked, gzip|identity|CHUNKED|chunked,| chunked|x"
const CONNECTIONS: string = "close|keep-alive|Upgrade|upgrade, keep-alive|Close|close, x|te"
const UPGRADES: string = "websocket|WebSocket|h2c|websocket, h2c|"

/** A line end: CRLF mostly, and now and then a bare LF, a bare CR or CR CR LF. */
const eol = (r: Rng, out: Out): void => {
  const roll: i32 = r.below(200)
  if (roll === 0) {
    out.text("\n")
  } else if (roll === 1) {
    out.text("\r")
  } else if (roll === 2) {
    out.text("\r\r\n")
  } else {
    out.text("\r\n")
  }
}

/** One request the grammar draws; `s` is the setup it will run under, for sizes near its limits. */
const requestOf = (r: Rng, out: Out, s: Setup): void => {
  // The request line.
  if (r.oneIn(20)) {
    tokenOf(r, out, HTTP1_MAX_METHOD - 2 + r.below(5))
  } else if (r.oneIn(20)) {
    tokenOf(r, out, 1 + r.below(10))
  } else {
    out.text(pick(r, METHODS))
  }
  out.text(r.oneIn(40) ? "  " : " ")
  if (r.oneIn(6)) {
    out.text("/")
    const near: i32 = s.maxTarget < 200 ? s.maxTarget : 200
    valueOf(r, out, r.oneIn(4) ? near - 2 + r.below(5) : r.below(near + 1))
  } else {
    out.text(pick(r, TARGETS))
  }
  out.text(r.oneIn(40) ? "\t" : " ")
  out.text(pick(r, VERSIONS))
  eol(r, out)
  // The fields: most requests open with the one Host a request needs.
  if (!r.oneIn(8)) {
    out.text("Host: example.org")
    eol(r, out)
  }
  let nfields: i32 = r.below(7)
  if (r.oneIn(10)) {
    nfields = s.maxHeaders - 1 + r.below(3)
    if (nfields > 120) {
      nfields = 120
    }
  }
  let length: i32 = -1
  let chunked: boolean = false
  for (let f: i32 = 0; f < nfields; f++) {
    const roll: i32 = r.below(100)
    if (roll < 4) {
      // obs-fold: a line that starts with whitespace.
      out.text(r.oneIn(2) ? " " : "\t")
      valueOf(r, out, r.below(10))
      eol(r, out)
      continue
    }
    let name: string = ""
    if (roll < 20) {
      tokenOf(r, out, r.below(24))
    } else {
      name = pick(r, NAMES)
      out.text(name)
    }
    if (r.oneIn(30)) {
      out.text(" ")
    }
    out.text(r.oneIn(80) ? "" : ":")
    const ows: i32 = r.below(4)
    if (ows === 1) {
      out.text(" ")
    } else if (ows === 2) {
      out.text("\t ")
    }
    if (name === "Content-Length" || name === "content-length") {
      const v: string = pick(r, LENGTHS)
      out.text(v)
      if (v === "0" || v === "1" || v === "5" || v === "10") {
        length = parseInt(v)
      }
    } else if (name === "Transfer-Encoding") {
      const v: string = pick(r, ENCODINGS)
      out.text(v)
      chunked = chunked || v === "chunked"
    } else if (name === "Connection") {
      out.text(pick(r, CONNECTIONS))
    } else if (name === "Upgrade") {
      out.text(pick(r, UPGRADES))
    } else {
      const big: boolean = r.oneIn(12)
      valueOf(r, out, big ? s.maxHeaderBytes / 2 + r.below(s.maxHeaderBytes / 2 + 8) : r.below(40))
    }
    if (r.oneIn(4)) {
      out.text(r.oneIn(2) ? " " : "\t")
    }
    eol(r, out)
  }
  eol(r, out)
  // The body.
  if (chunked && !r.oneIn(8)) {
    const chunks: i32 = r.below(4)
    for (let c: i32 = 0; c < chunks; c++) {
      const size: i32 = 1 + r.below(20)
      out.text(hexNumber(size, r.oneIn(10)))
      if (r.oneIn(8)) {
        out.text(";ext=1")
      }
      eol(r, out)
      valueOf(r, out, r.oneIn(10) ? size + 1 : size)
      eol(r, out)
    }
    out.text(r.oneIn(15) ? "x" : "0")
    eol(r, out)
    if (r.oneIn(5)) {
      out.text("Trailer-Field: v")
      eol(r, out)
    }
    eol(r, out)
  } else if (length > 0) {
    valueOf(r, out, r.oneIn(8) ? length - 1 : length)
  }
}

/** A random setup: the fuzz settings byte, then random cuts. */
const setupDrawn = (r: Rng): Setup => {
  const s: Setup = setupOf(r.below(64))
  const cutRoll: i32 = r.below(4)
  if (cutRoll === 1) {
    s.cuts = [1]
  } else if (cutRoll >= 2) {
    const count: i32 = 1 + r.below(4)
    for (let k: i32 = 0; k < count; k++) {
      s.cuts.push(r.below(24))
    }
  }
  return s
}

/**
 * The fuzz target's inputs in `dir`, each file run as the target reads it and
 * then under every cut; how many were read, or -1 when `dir` cannot be read.
 */
const inputCases = (tally: Tally, dir: string): i32 => {
  const files: string[] | null = readdirSync(dir)
  if (files === null) {
    return -1
  }
  // readdirSync's order is the file system's: sort, so the fingerprint is the same everywhere.
  const sorted: string[] = []
  for (let i: i32 = 0; i < toI32(files.length); i++) {
    let at: i32 = toI32(sorted.length)
    sorted.push(files[i])
    while (at > 0 && before(sorted[at], sorted[at - 1])) {
      const t: string = sorted[at]
      sorted[at] = sorted[at - 1]
      sorted[at - 1] = t
      at -= 1
    }
  }
  let read: i32 = 0
  for (let i: i32 = 0; i < toI32(sorted.length); i++) {
    const data: u8[] | null = readFileBytesSync(`${dir}/${sorted[i]}`)
    if (data === null || toI32(data.length) < 5) {
      continue
    }
    read += 1
    const s: Setup = setupOf(toI32(data[0]))
    for (let k: i32 = 1; k <= 4; k++) {
      s.cuts.push(toI32(data[k]))
    }
    const stream: u8[] = sliceBytes(data, 5, toI32(data.length))
    run(tally, s, stream)
    for (let config: i32 = 0; config < 64; config++) {
      runCut(tally, setupOf(config), stream, config % 8 === 0)
    }
  }
  return read
}

/** The fuzz corpus, then the regressions the fuzz target once failed on (none yet). */
const corpusCases = (tally: Tally): void => {
  tally.label = "corpus"
  const dir: string = "tests/fuzz/corpus/http1"
  const read: i32 = inputCases(tally, dir)
  if (read < 10) {
    writeError(`net_http1_parse_diff: only ${read} corpus files read from ${dir}\n`)
    tally.failed = true
    return
  }
  // regressions/http1 does not exist until a fuzz failure lands one there.
  inputCases(tally, "tests/fuzz/regressions/http1")
}

/** Three requests to mutate: a short GET, a POST with a body and a field-heavy GET. */
const BASES: string = "GET /a HTTP/1.1\r\nHost: h\r\n\r\n|POST /api/items HTTP/1.1\r\nHost: 10.0.0.2\r\nContent-Length: 5\r\nConnection: keep-alive\r\n\r\nhello|GET /x?y=z HTTP/1.0\r\nHost: example.org\r\nAccept: */*\r\nTransfer-Encoding: chunked\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n3\r\nabc\r\n0\r\n\r\n"

/** Every byte at every position of each base, then nine bytes inserted at every position. */
const mutationCases = (tally: Tally): void => {
  tally.label = "mutation"
  const inserts: i32[] = [13, 10, 32, 9, 0, 58, 128, 255, 127]
  const bases: string[] = wordsOf(BASES)
  for (let b: i32 = 0; b < toI32(bases.length); b++) {
    const base: u8[] = bytesOf(bases[b])
    const n: i32 = toI32(base.length)
    const s: Setup = setupOf(b === 1 ? 2 : 0)
    for (let at: i32 = 0; at < n; at++) {
      for (let v: i32 = 0; v < 256; v++) {
        const xs: u8[] = sliceBytes(base, 0, n)
        xs[at] = toU8(v)
        run(tally, s, xs)
      }
    }
    for (let at: i32 = 0; at <= n; at++) {
      for (let k: i32 = 0; k < toI32(inserts.length); k++) {
        const xs: u8[] = new Out().bytes(sliceBytes(base, 0, at)).byte(inserts[k]).bytes(sliceBytes(base, at, n)).xs
        run(tally, s, xs)
        s.cuts = [at + 1, 0]
        run(tally, s, xs)
        s.cuts = []
      }
    }
    // Every split point, byte at a time, and each base followed by each base.
    runCut(tally, setupOf(0), base, true)
    runCut(tally, setupOf(2), base, true)
    runCut(tally, setupOf(1), base, true)
    for (let c: i32 = 0; c < toI32(bases.length); c++) {
      const pair: u8[] = new Out().bytes(base).text(bases[c]).xs
      runCut(tally, setupOf(0), pair, true)
      runCut(tally, setupOf(18), pair, false)
    }
  }
}

/** `n` copies of `t`. */
const repeat = (t: string, n: i32): string => {
  const parts: string[] = []
  for (let i: i32 = 0; i < n; i++) {
    parts.push(t)
  }
  return parts.join("")
}

/** Each limit at its value -1, 0 and +1, with every cut. */
const limitCases = (tally: Tally): void => {
  tally.label = "limit"
  if (HTTP1_MAX_METHOD !== H1OLD_MAX_METHOD) {
    writeError("net_http1_parse_diff: HTTP1_MAX_METHOD moved\n")
    tally.failed = true
    return
  }
  for (let d: i32 = -1; d <= 1; d++) {
    // The method.
    const method: string = repeat("M", HTTP1_MAX_METHOD + d)
    runCut(tally, setupOf(0), bytesOf(`${method} / HTTP/1.1\r\nHost: h\r\n\r\n`), true)
    for (let limit: i32 = 0; limit <= 2; limit++) {
      const s = new Setup()
      const size: i32 = limit === 0 ? 16 : limit === 1 ? 64 : 300
      // The target.
      s.maxTarget = size
      const target: string = `/${repeat("t", size - 1 + d)}`
      runCut(tally, s, bytesOf(`GET ${target} HTTP/1.1\r\n\r\n`), true)
      runCut(tally, s, bytesOf(`${repeat("M", HTTP1_MAX_METHOD)} ${target} HTTP/1.10\r\n\r\n`), false)
      // The header section: its field lines and the empty line that ends it
      // come to maxHeaderBytes + d, with one field or with `A: b` before it.
      const t = new Setup()
      t.maxHeaderBytes = size + 8
      const line: string = `X: ${repeat("v", size + 8 + d - 7)}\r\n`
      runCut(tally, t, bytesOf(`GET / HTTP/1.1\r\n${line}\r\n`), size < 300)
      const after: string = `X: ${repeat("v", size + 8 + d - 13)}\r\n`
      runCut(tally, t, bytesOf(`GET / HTTP/1.1\r\nA: b\r\n${after}\r\n`), false)
      // The field count.
      const u = new Setup()
      u.maxHeaders = size / 8
      runCut(tally, u, bytesOf(`GET / HTTP/1.1\r\n${repeat("A: b\r\n", size / 8 + d)}\r\n`), size < 300)
      // The body.
      const v = new Setup()
      v.maxBody = size
      runCut(tally, v, bytesOf(`POST / HTTP/1.1\r\nContent-Length: ${size + d}\r\n\r\n${repeat("b", size + d)}`), false)
      const w = new Setup()
      w.maxBody = size
      w.maxChunk = 3
      runCut(tally, w, bytesOf(`POST / HTTP/1.1\r\nTransfer-Encoding: chunked\r\n\r\n${hexNumber(size + d, false)}\r\n${repeat("b", size + d)}\r\n0\r\n\r\n`), false)
    }
  }
}

/** One drawn grammar case and what runs it: a region's root, freed when the case ends. */
class Drawn {
  t: Tally
  r: Rng
  s: Setup
  xs: u8[]
  constructor(seed: u32) {
    this.t = new Tally()
    this.r = new Rng()
    this.r.x = seed
    this.s = setupDrawn(this.r)
    const out = new Out()
    const requests: i32 = 1 + this.r.below(3)
    for (let q: i32 = 0; q < requests; q++) {
      requestOf(this.r, out, this.s)
    }
    if (this.r.oneIn(10)) {
      // A byte anywhere set to anything.
      const at: i32 = this.r.below(toI32(out.xs.length) + 1)
      if (at < toI32(out.xs.length)) {
        out.xs[at] = toU8(this.r.below(256))
      }
    }
    this.xs = out.xs
  }
}

const drawnOf = (seed: u32): Drawn => new Drawn(seed)

const drawnCases = (d: Drawn, cases: i32): i32 => {
  d.t.cases = cases
  return cases
}

const drawnPrint = (d: Drawn, print: u32): u32 => {
  d.t.print = print
  return print
}

const drawnRun = (d: Drawn): u32 => {
  runParsers(d.t, d.s, d.xs, makeNew(d.s), makeOld(d.s))
  return d.r.x
}

const drawnOut = (d: Drawn, to: Tally): boolean => {
  mergeTally(d.t, to)
  return to.failed
}

/** The grammar's requests, one to three to a stream, under random setups. */
const grammarCases = (tally: Tally, seed: u32, count: i32): void => {
  tally.label = "grammar"
  let x: u32 = seed === 0 ? 2463534242 : seed
  for (let i: i32 = 0; i < count && !tally.failed; i++) {
    // The request, its setup and both parsers live in a region the case frees;
    // the generator's state is carried from one case to the next as a number.
    tally.cases += 1
    const g: Region<Drawn> = regionWith(x, drawnOf)
    enterWith(g, tally.cases, drawnCases)
    enterWith(g, tally.print, drawnPrint)
    x = enter(g, drawnRun)
    enterWith(g, tally, drawnOut)
    free(g)
    if (tally.failed) {
      writeError("  section: grammar\n")
    }
  }
}

/**
 * The number in the environment variable `name`, or `fallback` when it is
 * unset; -1 when it is set to anything but decimal digits, so a mistyped soak
 * does not run no cases and still report agreement.
 */
const envNumber = (name: string, fallback: i32): i32 => {
  const text: string | null = getenv(name)
  if (text === null || toI32(text.length) === 0) {
    return fallback
  }
  if (toI32(text.length) > 9) {
    writeError(`net_http1_parse_diff: ${name} is ${text}, not a count under 10^9\n`)
    return -1
  }
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    const c: i32 = text.charCodeAt(i)
    if (c < 48 || c > 57) {
      writeError(`net_http1_parse_diff: ${name} is ${text}, not a decimal number\n`)
      return -1
    }
  }
  return parseInt(text)
}

export const main = (): i32 => {
  const seed: i32 = envNumber("HTTP1_DIFF_SEED", 1175)
  const count: i32 = envNumber("HTTP1_DIFF_CASES", 100000)
  if (seed < 0 || count < 0) {
    return 2
  }
  const tally = new Tally()
  corpusCases(tally)
  const afterCorpus: i32 = tally.cases
  mutationCases(tally)
  const afterMutation: i32 = tally.cases
  limitCases(tally)
  const afterLimit: i32 = tally.cases
  grammarCases(tally, toU32(seed), count)
  if (tally.failed) {
    return 1
  }
  console.log(`seed ${seed}, ${tally.cases} cases agree`)
  console.log(
    `  corpus ${afterCorpus}, mutation ${afterMutation - afterCorpus}, limit ${afterLimit - afterMutation}, grammar ${tally.cases - afterLimit}`
  )
  console.log(
    `  events ${tally.events}: head ${tally.heads}, body ${tally.bodies}, end ${tally.ends}, upgrade ${tally.upgrades}, closed ${tally.closes}, error ${tally.errors}`
  )
  console.log(
    `  refusals: 400 ${tally.s400}, 413 ${tally.s413}, 414 ${tally.s414}, 431 ${tally.s431}, 501 ${tally.s501}, 505 ${tally.s505}, other ${tally.sOther}`
  )
  console.log(`  fingerprint ${hexNumber(toI32(tally.print >>> 4), false)}${hexNumber(toI32(tally.print & 15), false)}`)
  return 0
}
