// The HTTP/1.1 response parser (`nish/net/http1-client`) over a server's
// bytes, as a libFuzzer target: `fuzzOne` takes one input and keeps nothing
// past it, and a refusal is `HTTP1_ERROR` with an `HTTP1_E_` code, so a panic
// here is a finding (docs/security/http1-client.md).
//
// The first five bytes are settings and the rest is the response stream:
//
// - byte 0 picks the parser: bit 0 small limits (a 32-byte status line, a
//   256-byte header section, 8 fields, a 64-byte body, 64 bytes of trailers)
//   or a client's usual ones; bit 1 whether each response answers a HEAD;
//   bit 2 whether it answers a CONNECT, so that a 2xx is a tunnel; bit 3
//   whether each piece is fed as an array of its own (the whole-array path)
//   or as a window into the input; bit 4 whether the server closes the
//   connection after the last piece, so that `finish()` ends a body read
//   until close or refuses a cut-short one.
// - bytes 1 to 4 are the sizes of the pieces the stream is cut into, used in
//   turn; a size of 0 takes everything left. Cutting the stream does not move
//   its bytes, so a mutation of the response text stays a response.
//
// After each piece the events are drained the way a client drains them: a
// head is read field by field, a body window is read byte by byte before the
// next `feed`, `expect` is said again after each `HTTP1_END`, and
// `HTTP1_UPGRADE`, `HTTP1_CLOSED` and `HTTP1_ERROR` stop the drain, since they
// repeat on every later call. The same stream is then fed to a second parser
// in one piece, and the two must agree on every event, every body byte and
// the error code: the module promises the cut never changes what is read.
import {
  HTTP1_BODY,
  HTTP1_CLOSED,
  HTTP1_END,
  HTTP1_ERROR,
  HTTP1_HEAD,
  HTTP1_NEED_MORE,
  HTTP1_UPGRADE,
} from "nish/net/http1"
import { HTTP1_E_INFORMATIONAL_LIMIT, HTTP1_E_NONE, HTTP1_INFORMATIONAL, Http1ResponseParser } from "nish/net/http1-client"

/** The parser the first byte asks for. */
const makeParser = (config: i32): Http1ResponseParser => {
  const small: i64 = 64
  const usual: i64 = 1048576
  return config % 2 === 1
    ? new Http1ResponseParser(32, 256, 8, small, 64)
    : new Http1ResponseParser(8192, 65536, 100, usual, 8192)
}

/** A running digest of what a parser said: its events, heads, body bytes and error. */
class Trace {
  sum: i32 = 0
  constructor() {}
}

/** Folds `value` into the digest, in order. */
const mix = (t: Trace, value: i32): void => {
  t.sum = (t.sum * 31 + value) % 65521
}

/**
 * Reads everything a caller would read of a head: the status, the reason and
 * every field, by name and in turn. Answers a sum of what it read, so that
 * none of it is dead code.
 */
const readHead = (p: Http1ResponseParser): i32 => {
  if (p.status < 100 || p.status > 999) {
    panic("http1-client fuzz: a head with a status outside 100 to 999")
  }
  let seen: i32 = p.status + toI32(p.reason.length)
  const length: string | null = p.header("content-length")
  if (length !== null) {
    seen += toI32(length.length)
  }
  if (p.keepAlive()) {
    seen += 1
  }
  const count: i32 = toI32(p.names.length)
  if (count !== toI32(p.values.length)) {
    panic("http1-client fuzz: names and values of different lengths")
  }
  for (let i: i32 = 0; i < count; i += 1) {
    seen += toI32(p.names[i].length) + toI32(p.values[i].length)
  }
  return seen
}

/** Reads the window the last `HTTP1_BODY` handed over, every byte of it. */
const readBody = (p: Http1ResponseParser, t: Trace): void => {
  if (p.bodyLen < 0 || p.bodyOff < 0 || p.bodyLen > toI32(p.body.length) - p.bodyOff) {
    panic("http1-client fuzz: a body window outside its buffer")
  }
  if (p.bodyTotal > p.maxBody) {
    panic("http1-client fuzz: more body than maxBody handed over")
  }
  const body: u8[] = p.body
  for (let k: i32 = 0; k < p.bodyLen; k += 1) {
    mix(t, toI32(body[p.bodyOff + k]))
  }
}

/**
 * Pulls events until the parser wants more input; answers true once it has
 * stopped for good (closed, refused, or a tunnel taken). `unfed` is how much of
 * the stream is still to come, which a tunnel's bytes are counted with, since
 * what `tunnelBytes()` holds depends on where the stream was cut.
 */
const drain = (p: Http1ResponseParser, head: boolean, connect: boolean, unfed: i32, t: Trace): boolean => {
  let e: i32 = p.next()
  while (e !== HTTP1_NEED_MORE) {
    if (e !== HTTP1_BODY) {
      mix(t, e)
    }
    if (e === HTTP1_HEAD || e === HTTP1_INFORMATIONAL) {
      mix(t, readHead(p))
    } else if (e === HTTP1_BODY) {
      readBody(p, t)
    } else if (e === HTTP1_END) {
      p.expect(head, connect)
    } else if (e === HTTP1_UPGRADE) {
      if (!connect) {
        panic("http1-client fuzz: a tunnel without a CONNECT")
      }
      const rest: u8[] = p.tunnelBytes()
      mix(t, toI32(rest.length) + unfed)
      return true
    } else if (e === HTTP1_CLOSED) {
      return true
    } else if (e === HTTP1_ERROR) {
      if (p.error === HTTP1_E_NONE || p.error > HTTP1_E_INFORMATIONAL_LIMIT) {
        panic("http1-client fuzz: a refusal without an error code")
      }
      mix(t, p.error)
      if (p.buffered() !== 0) {
        panic("http1-client fuzz: input kept after a refusal")
      }
      return true
    } else {
      panic("http1-client fuzz: an event the module does not define")
    }
    e = p.next()
  }
  return false
}

/**
 * Feeds `data[5 ..)` to a fresh parser in the pieces bytes 1 to 4 ask for, or
 * in one piece when `whole`, and answers the digest of what it said.
 */
const readStream = (data: u8[], whole: boolean): i32 => {
  const n: i32 = toI32(data.length)
  const config: i32 = toI32(data[0])
  const p: Http1ResponseParser = makeParser(config)
  const head: boolean = (config / 2) % 2 === 1
  const connect: boolean = (config / 4) % 2 === 1
  const copy: boolean = (config / 8) % 2 === 1
  const close: boolean = (config / 16) % 2 === 1
  const t: Trace = new Trace()
  p.expect(head, connect)
  let at: i32 = 5
  let piece: i32 = 0
  while (at < n) {
    const size: i32 = whole ? 0 : toI32(data[1 + (piece % 4)])
    piece += 1
    const take: i32 = size === 0 || size > n - at ? n - at : size
    if (copy) {
      const own: u8[] = new Array<u8>(take)
      for (let k: i32 = 0; k < take; k += 1) {
        own[k] = data[at + k]
      }
      p.feed(own, 0, take)
    } else {
      p.feed(data, at, take)
    }
    at += take
    if (drain(p, head, connect, n - at, t)) {
      return t.sum
    }
  }
  if (close) {
    p.finish()
    drain(p, head, connect, 0, t)
  }
  return t.sum
}

export const fuzzOne = (data: u8[]): void => {
  if (toI32(data.length) < 5) {
    return
  }
  if (readStream(data, false) !== readStream(data, true)) {
    panic("http1-client fuzz: the cut changed what was read")
  }
}
