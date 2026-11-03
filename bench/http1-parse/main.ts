// The HTTP/1.1 request parser in nanoseconds a head, under bench/crypto/README.md's
// program contract. bench/http1-parse/run.mjs builds it with `--profile speed`
// and runs
//
//   main <parser> <head> <iterations>
//
//   <parser>  new       nish/net/http1-codec, the live parser
//             old       ./old, main's parser frozen by freeze.mjs
//             old-copy  ./old-copy, the same code again: the noise band
//   <head>    0         loadgen GET: six lines, a 180-byte Authorization token
//             1         loadgen POST: the same with Content-Type, Content-Length
//                       and a 60-byte JSON body
//             2         browser GET: sixteen fields of a browser's lengths
//
// Each iteration feeds one request to one kept-alive parser in the mode
// nish/net/http1-server runs it in (`keepText` off), and calls `next()` until
// the request's `HTTP1_END`: a server's read, parse and wait for the response,
// minus the socket. It prints a checksum of what every request parsed to on
// stdout (the method and target spans, the field spans, the content length,
// the body bytes) and the timed loop's nanoseconds on stderr.
import { HTTP1_BODY, HTTP1_END, HTTP1_HEAD, HTTP1_NEED_MORE, Http1Parser } from "nish/net/http1-codec"
import { now, parseArgs, report } from "../crypto/lib/gen"
import { H1A_BODY, H1A_END, H1A_HEAD, H1A_NEED_MORE, H1aParser } from "./old"
import { H1B_BODY, H1B_END, H1B_HEAD, H1B_NEED_MORE, H1bParser } from "./old-copy"

/** The limits nish/net/http1-server defaults to. */
const MAX_TARGET: i32 = 8192
const MAX_HEADER_BYTES: i32 = 16384
const MAX_HEADERS: i32 = 100
const MAX_BODY: i32 = 1048576

/** `n` bytes of base64url text, a JWT's alphabet, drawn from `seed`. */
const tokenText = (n: i32, seed: i32): string => {
  const alphabet: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
  const parts: string[] = []
  let x: u32 = toU32(seed)
  for (let i: i32 = 0; i < n; i++) {
    x = x ^ (x << 13)
    x = x ^ (x >>> 17)
    x = x ^ (x << 5)
    const at: i32 = toI32(x & 63)
    if (i === 36 || i === 120) {
      parts.push(".")
    } else {
      parts.push(alphabet.slice(at, at + 1))
    }
  }
  return parts.join("")
}

/** The request `head` names, as bytes. */
const requestOf = (head: i32): u8[] => {
  const crlf: string = "\r\n"
  const lines: string[] = []
  if (head === 2) {
    lines.push("GET /docs/guide/getting-started?ref=nav HTTP/1.1")
    lines.push("Host: www.example.org")
    lines.push(
      "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
    )
    lines.push(
      "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
    )
    lines.push("Accept-Language: en-GB,en;q=0.9,de;q=0.8")
    lines.push("Accept-Encoding: gzip, deflate, br, zstd")
    lines.push("Referer: https://www.example.org/docs/guide/index")
    lines.push(
      `Cookie: session=${tokenText(120, 7)}; theme=dark; _ga=GA1.2.${tokenText(40, 9)}; prefs=${tokenText(110, 11)}`
    )
    lines.push("Sec-Fetch-Dest: document")
    lines.push("Sec-Fetch-Mode: navigate")
    lines.push("Sec-Fetch-Site: same-origin")
    lines.push("Sec-Fetch-User: ?1")
    lines.push('Sec-CH-UA: "Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"')
    lines.push("Sec-CH-UA-Mobile: ?0")
    lines.push('Sec-CH-UA-Platform: "Linux"')
    lines.push("Upgrade-Insecure-Requests: 1")
    lines.push("Priority: u=0, i")
    lines.push("")
    return toBytes(lines.join(crlf) + crlf)
  }
  const post: boolean = head === 1
  lines.push(post ? "POST /api/items HTTP/1.1" : "GET /api/items/42 HTTP/1.1")
  lines.push("Host: 10.0.0.2:8080")
  lines.push("User-Agent: loadgen/1.0")
  lines.push("Accept: application/json")
  lines.push("Accept-Encoding: gzip, deflate")
  lines.push(`Authorization: Token ${tokenText(180, 3)}`)
  if (post) {
    lines.push("Content-Type: application/json")
    lines.push("Content-Length: 60")
  }
  lines.push("")
  let text: string = lines.join(crlf) + crlf
  if (post) {
    text = text + '{"name":"widget","count":12,"tags":["a","b"],"ok":true,"n":1}'.substring(0, 60)
  }
  return toBytes(text)
}

/** The bytes of `text`, which is ASCII. */
const toBytes = (text: string): u8[] => {
  const out: u8[] = new Array<u8>(toI32(text.length))
  for (let i: i32 = 0; i < toI32(out.length) && i < toI32(text.length); i++) {
    out[i] = toU8(text.charCodeAt(i))
  }
  return out
}

/** One step of FNV-1a over a whole `i32`. */
const mix = (sum: u32, x: i32): u32 => (sum ^ toU32(x)) * 16777619

/** What a parser's head is, as `mix` folds it: the same for every parser. */
const headSum = (
  sum0: u32,
  methodStart: i32,
  methodEnd: i32,
  targetStart: i32,
  targetEnd: i32,
  count: i32,
  spans: i32[],
  contentLength: i32
): u32 => {
  let sum: u32 = mix(sum0, methodStart)
  sum = mix(sum, methodEnd)
  sum = mix(sum, targetStart)
  sum = mix(sum, targetEnd)
  sum = mix(sum, count)
  for (let k: i32 = 0; k < 4 * count && k < toI32(spans.length); k++) {
    sum = mix(sum, spans[k])
  }
  return mix(sum, contentLength)
}

const runNew = (request: u8[], iterations: i32): i32 => {
  const p = new Http1Parser(MAX_TARGET, MAX_HEADER_BYTES, MAX_HEADERS, MAX_BODY)
  p.keepText = false
  const n: i32 = toI32(request.length)
  let sum: u32 = 2166136261
  const started: i64 = now()
  for (let i: i32 = 0; i < iterations; i++) {
    p.feed(request, 0, n)
    let event: i32 = p.next()
    while (event !== HTTP1_END) {
      if (event === HTTP1_HEAD) {
        sum = headSum(
          sum,
          p.methodStart,
          p.methodEnd,
          p.targetStart,
          p.targetEnd,
          p.headerCount,
          p.spans,
          p.contentLength
        )
      } else if (event === HTTP1_BODY) {
        sum = mix(sum, p.bodyLen)
      } else if (event === HTTP1_NEED_MORE || p.status !== 0) {
        writeError(`new: request ${i} stopped at event ${event}, status ${p.status}\n`)
        return 1
      }
      event = p.next()
    }
  }
  report(sum, started)
  return 0
}

const runOld = (request: u8[], iterations: i32): i32 => {
  const p = new H1aParser(MAX_TARGET, MAX_HEADER_BYTES, MAX_HEADERS, MAX_BODY)
  p.keepText = false
  const n: i32 = toI32(request.length)
  let sum: u32 = 2166136261
  const started: i64 = now()
  for (let i: i32 = 0; i < iterations; i++) {
    p.feed(request, 0, n)
    let event: i32 = p.next()
    while (event !== H1A_END) {
      if (event === H1A_HEAD) {
        sum = headSum(
          sum,
          p.methodStart,
          p.methodEnd,
          p.targetStart,
          p.targetEnd,
          p.headerCount,
          p.spans,
          p.contentLength
        )
      } else if (event === H1A_BODY) {
        sum = mix(sum, p.bodyLen)
      } else if (event === H1A_NEED_MORE || p.status !== 0) {
        writeError(`old: request ${i} stopped at event ${event}, status ${p.status}\n`)
        return 1
      }
      event = p.next()
    }
  }
  report(sum, started)
  return 0
}

const runOldCopy = (request: u8[], iterations: i32): i32 => {
  const p = new H1bParser(MAX_TARGET, MAX_HEADER_BYTES, MAX_HEADERS, MAX_BODY)
  p.keepText = false
  const n: i32 = toI32(request.length)
  let sum: u32 = 2166136261
  const started: i64 = now()
  for (let i: i32 = 0; i < iterations; i++) {
    p.feed(request, 0, n)
    let event: i32 = p.next()
    while (event !== H1B_END) {
      if (event === H1B_HEAD) {
        sum = headSum(
          sum,
          p.methodStart,
          p.methodEnd,
          p.targetStart,
          p.targetEnd,
          p.headerCount,
          p.spans,
          p.contentLength
        )
      } else if (event === H1B_BODY) {
        sum = mix(sum, p.bodyLen)
      } else if (event === H1B_NEED_MORE || p.status !== 0) {
        writeError(`old-copy: request ${i} stopped at event ${event}, status ${p.status}\n`)
        return 1
      }
      event = p.next()
    }
  }
  report(sum, started)
  return 0
}

export const main = (): i32 => {
  const a = parseArgs("http1-parse")
  if (a === null) {
    return 2
  }
  if (a.size > 2) {
    writeError("http1-parse: the head is 0, 1 or 2\n")
    return 2
  }
  const request: u8[] = requestOf(a.size)
  if (a.iterations === 1) {
    // One iteration is the checking run: the head's length, for the table.
    writeError(`bytes ${toI32(request.length)}\n`)
  }
  if (a.kernel === "new") {
    return runNew(request, a.iterations)
  }
  if (a.kernel === "old") {
    return runOld(request, a.iterations)
  }
  if (a.kernel === "old-copy") {
    return runOldCopy(request, a.iterations)
  }
  writeError(`http1-parse: no parser named ${a.kernel}\n`)
  return 2
}
