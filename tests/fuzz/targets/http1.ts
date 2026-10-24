// The HTTP/1.1 request parser (`nish/net/http1`) over a peer's bytes, as a
// libFuzzer target: `fuzzOne` takes one input and keeps nothing past it, and a
// refusal is `HTTP1_ERROR` with a status, so a panic here is a finding
// (docs/security/http1.md).
//
// The first five bytes are settings and the rest is the request stream:
//
// - byte 0 picks the parser: bit 0 small limits (a 16-byte target, a 64-byte
//   header section, 4 fields, a 32-byte body) or the server's defaults; bit 1
//   `keepText` off, so the head is read through the spans as a server that
//   allocates nothing reads it; bits 2 and 3 `maxChunk` (left alone, 1, 3 or
//   16); bit 4 whether an upgrade is declined, so that the bytes after it are
//   read as the next request, or taken with `upgradeBytes()` as a server that
//   switches would; bit 5 whether each piece is fed as an array of its own
//   (the whole-array `set` path) or as a window into the input.
// - bytes 1 to 4 are the sizes of the pieces the stream is cut into, used in
//   turn; a size of 0 takes everything left. Cutting the stream does not move
//   its bytes, so a mutation of the request text stays a request.
//
// After each piece the events are drained the way a server drains them: a
// head is read field by field, a body window is read byte by byte before the
// next `feed`, and `HTTP1_UPGRADE`, `HTTP1_CLOSED` and `HTTP1_ERROR` stop the
// drain, since they repeat on every later call.
import {
  HTTP1_BODY,
  HTTP1_CLOSED,
  HTTP1_END,
  HTTP1_ERROR,
  HTTP1_HEAD,
  HTTP1_NEED_MORE,
  HTTP1_UPGRADE,
  Http1Parser,
} from "nish/net/http1"

/** The parser the first byte asks for. */
const makeParser = (config: i32): Http1Parser => {
  const p: Http1Parser =
    config % 2 === 1 ? new Http1Parser(16, 64, 4, 32) : new Http1Parser(8192, 16384, 100, 1048576)
  p.keepText = (config / 2) % 2 === 0
  const chunk: i32 = (config / 4) % 4
  if (chunk === 1) {
    p.maxChunk = 1
  } else if (chunk === 2) {
    p.maxChunk = 3
  } else if (chunk === 3) {
    p.maxChunk = 16
  }
  return p
}

/**
 * Reads everything a handler would read of a head: the method, the target,
 * every field by name and the upgrade, through strings when the parser keeps
 * them and through the spans when it does not. Answers a sum of what it read,
 * so that none of it is dead code.
 */
const readHead = (p: Http1Parser): i32 => {
  let seen: i32 = 0
  if (p.methodIs("GET") || p.targetIs("/")) {
    seen += 1
  }
  if (p.upgradeIs("websocket")) {
    seen += 1
  }
  if (p.headerIs("connection", "close")) {
    seen += 1
  }
  const host: string | null = p.header("host")
  if (host !== null) {
    seen += toI32(host.length)
  }
  if (p.keepText) {
    seen += toI32(p.method.length) + toI32(p.target.length) + toI32(p.upgrade.length)
    const count: i32 = toI32(p.names.length)
    for (let i: i32 = 0; i < count; i += 1) {
      seen += toI32(p.names[i].length)
      if (i < toI32(p.values.length)) {
        seen += toI32(p.values[i].length)
      }
    }
  }
  const head: u8[] = p.head
  for (let i: i32 = p.methodStart; i < p.methodEnd; i += 1) {
    seen += toI32(head[i])
  }
  for (let i: i32 = p.targetStart; i < p.targetEnd; i += 1) {
    seen += toI32(head[i])
  }
  for (let i: i32 = 0; i < p.headerCount; i += 1) {
    for (let k: i32 = p.spans[4 * i]; k < p.spans[4 * i + 1]; k += 1) {
      seen += toI32(head[k])
    }
    for (let k: i32 = p.spans[4 * i + 2]; k < p.spans[4 * i + 3]; k += 1) {
      seen += toI32(head[k])
    }
  }
  return seen
}

/** Reads the window the last `HTTP1_BODY` handed over, every byte of it. */
const readBody = (p: Http1Parser): i32 => {
  if (p.bodyLen < 0) {
    panic("http1 fuzz: a negative body window")
  }
  let sum: i32 = 0
  const body: u8[] = p.body
  for (let k: i32 = 0; k < p.bodyLen; k += 1) {
    sum += toI32(body[p.bodyOff + k])
  }
  return sum
}

/**
 * Pulls events until the parser wants more input; answers true once it has
 * stopped for good (closed, refused, or switched protocols and taken).
 */
const drain = (p: Http1Parser, decline: boolean): boolean => {
  let e: i32 = p.next()
  while (e !== HTTP1_NEED_MORE) {
    if (e === HTTP1_HEAD) {
      readHead(p)
    } else if (e === HTTP1_BODY) {
      readBody(p)
    } else if (e === HTTP1_UPGRADE) {
      if (!decline) {
        p.upgradeBytes()
        return true
      }
      p.declineUpgrade()
    } else if (e === HTTP1_CLOSED) {
      return true
    } else if (e === HTTP1_ERROR) {
      if (p.status < 400 || p.status > 599) {
        panic("http1 fuzz: a refusal without an error status")
      }
      return true
    } else if (e !== HTTP1_END) {
      panic("http1 fuzz: an event the module does not define")
    }
    e = p.next()
  }
  return false
}

export const fuzzOne = (data: u8[]): void => {
  const n: i32 = toI32(data.length)
  if (n < 5) {
    return
  }
  const config: i32 = toI32(data[0])
  const p: Http1Parser = makeParser(config)
  const decline: boolean = (config / 16) % 2 === 1
  const copy: boolean = (config / 32) % 2 === 1
  let at: i32 = 5
  let piece: i32 = 0
  while (at < n) {
    const size: i32 = toI32(data[1 + (piece % 4)])
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
    if (drain(p, decline)) {
      return
    }
  }
}
