// `nish/net/static` over loopback: a fixture directory the program writes,
// served by one `StaticFiles` through `nish/net/http-server` on HTTP/1.1,
// HTTP/2 over TLS, h2c and HTTP/3, and through `nish/net/handler`, with
// scripted clients in the same process.
//
//   1. HTTP/1.1, the whole behaviour: a content type for each of .css .js
//      .html .woff2 .svg .webp .json; `index.html` for a directory; ETag,
//      Last-Modified, `nosniff` and `accept-ranges`; 304 by If-None-Match and
//      by If-Modified-Since; 206 for a range and a suffix, 200 for a multipart
//      range and a failed If-Range, 416 for an unsatisfiable or malformed
//      one; HEAD; 405 with its `Allow`; a file past the cache streamed whole
//      and by range.
//   2. Traversal refused: `..`, an encoded `..`, a dotfile, an encoded
//      backslash and NUL all answer not found with `refused` set; a missing
//      file answers not found without it.
//   3. Precompressed siblings: `br` and `gzip` by q-value, `br` on a tie,
//      `Content-Encoding`, `Vary: Accept-Encoding`, a per-variant ETag, and a
//      range counted in the coded bytes.
//   4. The cache follows the disk: a file rewritten is served new, with a new
//      ETag, and a file removed is not found.
//   5. HTTP/2 over TLS, h2c, HTTP/3 and the handler: a type, a range, a 304
//      and a refused traversal on each.
import { Secret, secret, wipe } from "nish:secret"
import { mkdirSync, unlinkSync, writeFileBytesSync, writeFileSync } from "nish:fs"
import { netAddress, netRead, netWrite, tcpConnect } from "nish:net"
import { Suite } from "nish/testing"
import { H2_FLAG_END_STREAM } from "nish/net/http2-frame"
import { H3_FRAME_HEADERS, H3_STREAM_CONTROL, H3_STREAM_QPACK_DECODER, H3_STREAM_QPACK_ENCODER } from "nish/net/http3-frame"
import { QpackEncoder } from "nish/net/qpack"
import { STATIC_NOT_FOUND, StaticFiles, StaticLimits } from "nish/net/static"
import { n32, n64 } from "../net_quic_frame/typed"
import { leafPrivate } from "../net_tls_common/server"
import { Wire, getOf } from "../net_http2/peer"
import { CLIENT_CONTROL, CLIENT_DECODER, CLIENT_ENCODER, H3Limits, h3Cat, h3ClientParams, h3ClientSettings, h3Frame, h3Section, h3Varint } from "../net_http3/peer"
import { textOf } from "../crypto_x509/hex"
import { ZERO } from "../net_tls_record_common/bytes"
import { H2cClient, H2TlsClient, QuicClient, TURNS, h3Answer } from "./client"
import { StaticRig, WWW } from "./rig"

/** What `netRead` answers when nothing is waiting. */
const WOULD_BLOCK: i32 = -11

/** The size of `big.bin`: more than the cache keeps and more than one read. */
const BIG: i32 = 100000

/** The bytes of `big.bin`: `a` to `z` over and over. */
const bigBytes = (): u8[] => {
  const out: u8[] = new Array<u8>(BIG)
  for (let k: i32 = 0; k < BIG; k++) {
    out[k] = toU8(97 + (k % 26))
  }
  return out
}

/** Writes the fixture directory, and one file beside it that no path may reach. */
const writeFixtures = (): void => {
  mkdirSync("build")
  mkdirSync("build/link")
  mkdirSync("build/link/net_static")
  mkdirSync(WWW)
  mkdirSync(`${WWW}/sub`)
  writeFileSync(`${WWW}/index.html`, "<h1>home</h1>\n")
  writeFileSync(`${WWW}/page.html`, "<p>page</p>\n")
  writeFileSync(`${WWW}/site.css`, "body{color:red}\n")
  writeFileSync(`${WWW}/app.js`, "console.log(1)\n")
  writeFileSync(`${WWW}/app.js.br`, "BR-js")
  writeFileSync(`${WWW}/app.js.gz`, "GZ-js!")
  writeFileSync(`${WWW}/data.json`, `{"v":1}\n`)
  writeFileSync(`${WWW}/logo.svg`, "<svg/>\n")
  writeFileSync(`${WWW}/img.webp`, "RIFFxxxxWEBP")
  writeFileSync(`${WWW}/font.woff2`, "wOF2xxxx")
  writeFileSync(`${WWW}/empty.txt`, "")
  writeFileSync(`${WWW}/sub/index.html`, "<p>sub</p>\n")
  writeFileSync(`${WWW}/.secret`, "hidden\n")
  writeFileSync(`${WWW}/../outside.txt`, "outside\n")
  writeFileBytesSync(`${WWW}/big.bin`, bigBytes())
}

// ---- HTTP/1.1 -------------------------------------------------------------------

/** `head` sent over a fresh HTTP/1.1 connection to `port` (it ends in `Connection: close`); the whole response as text. */
const h1Send = (rig: StaticRig, key: Secret<u8[]>, port: i32, head: string): string => {
  const addr: u8[] = new Array<u8>(18)
  netAddress(addr, "127.0.0.1", port)
  const fd: i32 = tcpConnect(addr)
  if (fd < 0) {
    return ""
  }
  const out: u8[] = []
  for (let k: i32 = 0; k < toI32(head.length); k++) {
    out.push(toU8(head.charCodeAt(k)))
  }
  let sent: i32 = 0
  const got: u8[] = []
  const buf: u8[] = new Array<u8>(16384)
  for (let turn: i32 = 0; turn < TURNS; turn++) {
    if (sent < toI32(out.length)) {
      const w: i32 = netWrite(fd, out, sent, toI32(out.length) - sent)
      if (w > 0) {
        sent = sent + w
      }
    }
    rig.step(n32(5), key, null, null)
    let n: i32 = netRead(fd, buf, ZERO, toI32(buf.length))
    while (n > 0) {
      for (let k: i32 = 0; k < n; k++) {
        got.push(buf[k])
      }
      n = netRead(fd, buf, ZERO, toI32(buf.length))
    }
    if (n !== WOULD_BLOCK && n <= 0) {
      break
    }
  }
  return textOf(got)
}

/** `method path` with `fields` (each ending `\r\n`) over HTTP/1.1 to `port`; the response. */
const h1 = (rig: StaticRig, key: Secret<u8[]>, port: i32, method: string, path: string, fields: string): string =>
  h1Send(rig, key, port, `${method} ${path} HTTP/1.1\r\nHost: localhost\r\n${fields}Connection: close\r\n\r\n`)

/** The status code of an HTTP/1.1 response, or "" for none. */
const statusOf = (response: string): string => (response.startsWith("HTTP/1.1 ") ? response.substring(9, 12) : "")

/** The body of an HTTP/1.1 response: what follows its head. */
const bodyOf = (response: string): string => {
  const at: i32 = response.indexOf("\r\n\r\n")
  return at < 0 ? "" : response.substring(at + 4, toI32(response.length))
}

/** Whether `text` holds `name` (lowercase ASCII) at `at`, in either case. */
const nameAt = (text: string, at: i32, name: string): boolean => {
  for (let k: i32 = 0; k < toI32(name.length); k++) {
    const c: i32 = toI32(text.charCodeAt(at + k))
    const lower: i32 = c >= 65 && c <= 90 ? c + 32 : c
    if (lower !== toI32(name.charCodeAt(k))) {
      return false
    }
  }
  return true
}

/** The value of field `name` (lowercase) in an HTTP/1.1 response's head, in whatever case the server wrote it, or "" when it has none. */
const fieldOf = (response: string, name: string): string => {
  const end: i32 = response.indexOf("\r\n\r\n")
  let at: i32 = response.indexOf("\r\n")
  while (at >= 0 && at < end) {
    const from: i32 = at + 2
    const next: i32 = response.indexOf("\r\n", from)
    const colon: i32 = from + toI32(name.length)
    if (next - from > toI32(name.length) + 1 && nameAt(response, from, name) && response.charCodeAt(colon) === 58) {
      return response.substring(colon + 2, next)
    }
    at = next
  }
  return ""
}

/** One check of a response's status, body and fields at once, with every difference in its failure. */
const expect = (t: Suite, name: string, response: string, status: string, body: string, fields: string[]): void => {
  let got: string = `${statusOf(response)} ${bodyOf(response)}`
  let want: string = `${status} ${body}`
  for (let k: i32 = 0; k + 1 < toI32(fields.length); k += 2) {
    got = `${got} | ${fields[k]}=${fieldOf(response, fields[k])}`
    want = `${want} | ${fields[k]}=${fields[k + 1]}`
  }
  t.eqStr(name, got, want)
}

/** A content type for each extension the stage names. */
const typeChecks = (t: Suite, rig: StaticRig, key: Secret<u8[]>): void => {
  const port: i32 = rig.h2.h1Port
  const names: string[] = ["site.css", "app.js", "page.html", "font.woff2", "logo.svg", "img.webp", "data.json"]
  const types: string[] = [
    "text/css; charset=utf-8",
    "text/javascript; charset=utf-8",
    "text/html; charset=utf-8",
    "font/woff2",
    "image/svg+xml",
    "image/webp",
    "application/json",
  ]
  for (let k: i32 = 0; k < toI32(names.length); k++) {
    const r: string = h1(rig, key, port, "GET", `/static/${names[k]}`, "")
    t.eqStr(`.${names[k].substring(names[k].indexOf(".") + 1, toI32(names[k].length))}: 200 as ${types[k]}`, `${statusOf(r)} ${fieldOf(r, "content-type")}`, `200 ${types[k]}`)
  }
}

/** Waits `ms` milliseconds of wall-clock time. */
const pause = (ms: i64): void => {
  const until: i64 = toI64(Date.now()) + ms
  while (toI64(Date.now()) < until) {}
}

/** Two ASCII digits of `text` at `at` as a number. */
const twoDigits = (text: string, at: i32): i64 => toI64((toI32(text.charCodeAt(at)) - 48) * 10 + toI32(text.charCodeAt(at + 1)) - 48)

/** The second of the day an IMF-fixdate names (`Sun, 06 Nov 1994 08:49:37 GMT`), or -1 for another shape. */
const secondOfDay = (date: string): i64 =>
  toI32(date.length) === 29 ? twoDigits(date, 17) * 3600 + twoDigits(date, 20) * 60 + twoDigits(date, 23) : toI64(-1)

/**
 * `If-Range` with the date of a file written this second: two versions within
 * one second share the date, so it is not a validator and the whole file is
 * sent. Tried again unless both the file's stamp and the request fell in the
 * same second: the kernel's file clock can lag `Date.now()` into the second
 * before, and then the date is a validator and a 206 is right.
 */
const sameSecondCheck = (t: Suite, rig: StaticRig, key: Secret<u8[]>): void => {
  let judged = false
  for (let attempt: i32 = 0; attempt < 5 && !judged; attempt++) {
    // Early in a second, so the request most likely ends within it.
    while (toI64(Date.now()) % 1000 < 20 || toI64(Date.now()) % 1000 > 400) {}
    const second: i64 = toI64(Date.now()) / 1000
    writeFileSync(`${WWW}/fresh.txt`, `fresh ${attempt}\n`)
    const modified: string = fieldOf(h1(rig, key, rig.h2.h1Port, "GET", "/static/fresh.txt", ""), "last-modified")
    const r: string = h1(rig, key, rig.h2.h1Port, "GET", "/static/fresh.txt", `Range: bytes=0-3\r\nIf-Range: ${modified}\r\n`)
    if (toI64(Date.now()) / 1000 === second && secondOfDay(modified) === second % 86400) {
      judged = true
      t.ok("If-Range with the date of a file changed this second: the whole file", statusOf(r) === "200" && bodyOf(r) === `fresh ${attempt}\n`)
    }
  }
  t.ok("the same-second If-Range check ran within one second", judged)
}

/** Validators, conditional requests, ranges, HEAD and 405 over HTTP/1.1. */
const h1Checks = (t: Suite, rig: StaticRig, key: Secret<u8[]>): void => {
  const port: i32 = rig.h2.h1Port
  expect(t, "a directory serves its index.html", h1(rig, key, port, "GET", "/static/", ""), "200", "<h1>home</h1>\n", ["content-type", "text/html; charset=utf-8", "content-length", "14"])
  expect(t, "a subdirectory's trailing slash serves its index.html", h1(rig, key, port, "GET", "/static/sub/", ""), "200", "<p>sub</p>\n", [])
  const css: string = h1(rig, key, port, "GET", "/static/site.css", "")
  const etag: string = fieldOf(css, "etag")
  const modified: string = fieldOf(css, "last-modified")
  t.ok("a strong ETag, quoted, of the size and the modification time", etag.startsWith(`"10-`) && etag.endsWith(`"`) && !etag.startsWith("W/"))
  t.ok("Last-Modified as an IMF-fixdate", modified.endsWith(" GMT") && toI32(modified.length) === 29)
  expect(t, "nosniff and byte ranges offered", css, "200", "body{color:red}\n", ["x-content-type-options", "nosniff", "accept-ranges", "bytes"])
  expect(t, "If-None-Match with the ETag: 304, no body, the ETag again", h1(rig, key, port, "GET", "/static/site.css", `If-None-Match: ${etag}\r\n`), "304", "", ["etag", etag, "content-length", ""])
  expect(t, "If-None-Match in a list, weak: still 304", h1(rig, key, port, "GET", "/static/site.css", `If-None-Match: "x", W/${etag}\r\n`), "304", "", [])
  expect(t, "If-None-Match: * is 304", h1(rig, key, port, "GET", "/static/site.css", "If-None-Match: *\r\n"), "304", "", [])
  expect(t, "If-None-Match with another tag: 200", h1(rig, key, port, "GET", "/static/site.css", `If-None-Match: "nope"\r\n`), "200", "body{color:red}\n", [])
  expect(t, "If-Modified-Since the Last-Modified: 304", h1(rig, key, port, "GET", "/static/site.css", `If-Modified-Since: ${modified}\r\n`), "304", "", [])
  expect(t, "If-Modified-Since long before: 200", h1(rig, key, port, "GET", "/static/site.css", "If-Modified-Since: Sun, 06 Nov 1994 08:49:37 GMT\r\n"), "200", "body{color:red}\n", [])
  expect(t, "If-Modified-Since not a date: ignored, 200", h1(rig, key, port, "GET", "/static/site.css", "If-Modified-Since: yesterday\r\n"), "200", "body{color:red}\n", [])
  expect(t, "Range bytes=5-9: 206 with its Content-Range", h1(rig, key, port, "GET", "/static/site.css", "Range: bytes=5-9\r\n"), "206", "color", ["content-range", "bytes 5-9/16", "content-length", "5"])
  expect(t, "Range bytes=11-: to the end", h1(rig, key, port, "GET", "/static/site.css", "Range: bytes=11-\r\n"), "206", "red}\n", ["content-range", "bytes 11-15/16"])
  expect(t, "Range bytes=-2: the last two", h1(rig, key, port, "GET", "/static/site.css", "Range: bytes=-2\r\n"), "206", "}\n", ["content-range", "bytes 14-15/16"])
  expect(t, "Range past the end is clamped", h1(rig, key, port, "GET", "/static/site.css", "Range: bytes=14-99\r\n"), "206", "}\n", ["content-range", "bytes 14-15/16"])
  expect(t, "a multipart Range is answered whole", h1(rig, key, port, "GET", "/static/site.css", "Range: bytes=0-1,4-5\r\n"), "200", "body{color:red}\n", [])
  expect(t, "a Range in another unit is ignored", h1(rig, key, port, "GET", "/static/site.css", "Range: lines=1-2\r\n"), "200", "body{color:red}\n", [])
  expect(t, "If-Range with the ETag: the range", h1(rig, key, port, "GET", "/static/site.css", `Range: bytes=0-3\r\nIf-Range: ${etag}\r\n`), "206", "body", [])
  // A date validates only a file unchanged for a second or more: wait that long since the fixture wrote it.
  pause(1100)
  expect(t, "If-Range with the date: the range", h1(rig, key, port, "GET", "/static/site.css", `Range: bytes=0-3\r\nIf-Range: ${modified}\r\n`), "206", "body", [])
  expect(t, "If-Range with another tag: the whole file", h1(rig, key, port, "GET", "/static/site.css", `Range: bytes=0-3\r\nIf-Range: "old"\r\n`), "200", "body{color:red}\n", [])
  expect(t, "bad Range: a start past the end is 416 with bytes */size", h1(rig, key, port, "GET", "/static/site.css", "Range: bytes=50-60\r\n"), "416", "", ["content-range", "bytes */16", "content-length", "0"])
  expect(t, "bad Range: not a number is 416", h1(rig, key, port, "GET", "/static/site.css", "Range: bytes=a-b\r\n"), "416", "", [])
  expect(t, "bad Range: a last before the first is 416", h1(rig, key, port, "GET", "/static/site.css", "Range: bytes=9-5\r\n"), "416", "", [])
  expect(t, "bad Range: an empty suffix is 416", h1(rig, key, port, "GET", "/static/site.css", "Range: bytes=-0\r\n"), "416", "", [])
  expect(t, "bad Range: a number of 19 digits is 416", h1(rig, key, port, "GET", "/static/site.css", "Range: bytes=1234567890123456789-\r\n"), "416", "", ["content-range", "bytes */16"])
  expect(t, "bad Range: any range of an empty file is 416 with bytes */0", h1(rig, key, port, "GET", "/static/empty.txt", "Range: bytes=0-\r\n"), "416", "", ["content-range", "bytes */0"])
  expect(t, "HEAD: the length and no body", h1(rig, key, port, "HEAD", "/static/site.css", ""), "200", "", ["content-length", "16", "etag", etag])
  expect(t, "POST: 405 with Allow: GET, HEAD", h1(rig, key, port, "POST", "/static/site.css", "Content-Length: 0\r\n"), "405", "", ["allow", "GET, HEAD"])
  const big: string = h1(rig, key, port, "GET", "/static/big.bin", "")
  t.ok("a file past the cache streams whole", statusOf(big) === "200" && fieldOf(big, "content-length") === `${BIG}` && toI32(bodyOf(big).length) === BIG && bodyOf(big).startsWith("abcdefghijklmnopqrstuvwxyzabc") && bodyOf(big).endsWith("wxyzabcd"))
  expect(t, "and by range across a read", h1(rig, key, port, "GET", "/static/big.bin", "Range: bytes=65530-65541\r\n"), "206", "klmnopqrstuv", ["content-range", `bytes 65530-65541/${BIG}`])
}

/** Paths that leave the root, or name what it hides, are refused; a missing file is only missing. */
const traversalChecks = (t: Suite, rig: StaticRig, key: Secret<u8[]>): void => {
  const port: i32 = rig.h2.h1Port
  const paths: string[] = [
    "/static/../outside.txt",
    "/static/sub/../../outside.txt",
    "/static/%2e%2e/outside.txt",
    "/static/%2E%2E%2Foutside.txt",
    "/static/sub%2f..%2f..%2foutside.txt",
    "/static/.secret",
    "/static/%2esecret",
    "/static/sub%5c..%5c..%5coutside.txt",
    "/static/site.css%00.js",
    "/static/sub//index.html",
    "/static/%ZZ",
  ]
  for (let k: i32 = 0; k < toI32(paths.length); k++) {
    const r: string = h1(rig, key, port, "GET", paths[k], "")
    t.ok(`traversal refused: ${paths[k]} is 404 and refused`, statusOf(r) === "404" && rig.files.refused && r.indexOf("outside") < 0 && r.indexOf("hidden") < 0)
  }
  const missing: string = h1(rig, key, port, "GET", "/static/nope.css", "")
  t.ok("a missing file is 404, not refused", statusOf(missing) === "404" && !rig.files.refused)
}

/** `app.js.br` and `app.js.gz` beside `app.js`, chosen by `Accept-Encoding`. */
const precompressedChecks = (t: Suite, rig: StaticRig, key: Secret<u8[]>): void => {
  const port: i32 = rig.h2.h1Port
  const plain: string = h1(rig, key, port, "GET", "/static/app.js", "")
  const etag: string = fieldOf(plain, "etag")
  expect(t, "no Accept-Encoding: the file as it is, with Vary", plain, "200", "console.log(1)\n", ["content-encoding", "", "vary", "accept-encoding"])
  const br: string = h1(rig, key, port, "GET", "/static/app.js", "Accept-Encoding: gzip, deflate, br\r\n")
  expect(t, "br offered: app.js.br as br, the type of app.js", br, "200", "BR-js", ["content-encoding", "br", "content-type", "text/javascript; charset=utf-8", "vary", "accept-encoding", "content-length", "5"])
  t.ok("each variant has its own ETag", fieldOf(br, "etag").endsWith(`-br"`) && fieldOf(br, "etag") !== etag)
  const gz: string = h1(rig, key, port, "GET", "/static/app.js", "Accept-Encoding: gzip\r\n")
  expect(t, "gzip offered: app.js.gz as gzip", gz, "200", "GZ-js!", ["content-encoding", "gzip"])
  t.ok("and gzip's ETag differs from br's", fieldOf(gz, "etag").endsWith(`-gz"`))
  expect(t, "x-gzip counts as gzip", h1(rig, key, port, "GET", "/static/app.js", "Accept-Encoding: x-gzip\r\n"), "200", "GZ-js!", ["content-encoding", "gzip"])
  expect(t, "the higher q wins: gzip;q=0.8 over br;q=0.5", h1(rig, key, port, "GET", "/static/app.js", "Accept-Encoding: br;q=0.5, gzip;q=0.8\r\n"), "200", "GZ-js!", ["content-encoding", "gzip"])
  expect(t, "a tie goes to br", h1(rig, key, port, "GET", "/static/app.js", "Accept-Encoding: gzip, br\r\n"), "200", "BR-js", ["content-encoding", "br"])
  expect(t, "br;q=0 refuses br", h1(rig, key, port, "GET", "/static/app.js", "Accept-Encoding: br;q=0, gzip;q=0\r\n"), "200", "console.log(1)\n", ["content-encoding", ""])
  expect(t, "identity preferred over a coding", h1(rig, key, port, "GET", "/static/app.js", "Accept-Encoding: br;q=0.2, identity\r\n"), "200", "console.log(1)\n", ["content-encoding", ""])
  expect(t, "* covers br", h1(rig, key, port, "GET", "/static/app.js", "Accept-Encoding: *\r\n"), "200", "BR-js", ["content-encoding", "br"])
  expect(t, "a range counts the coded bytes", h1(rig, key, port, "GET", "/static/app.js", "Accept-Encoding: br\r\nRange: bytes=0-1\r\n"), "206", "BR", ["content-encoding", "br", "content-range", "bytes 0-1/5"])
  expect(t, "If-None-Match with br's ETag: 304 for br", h1(rig, key, port, "GET", "/static/app.js", `Accept-Encoding: br\r\nIf-None-Match: ${fieldOf(br, "etag")}\r\n`), "304", "", ["vary", "accept-encoding"])
  expect(t, "and 200 for the file as it is", h1(rig, key, port, "GET", "/static/app.js", `If-None-Match: ${fieldOf(br, "etag")}\r\n`), "200", "console.log(1)\n", [])
  expect(t, "a file with no sibling is sent as it is", h1(rig, key, port, "GET", "/static/site.css", "Accept-Encoding: br, gzip\r\n"), "200", "body{color:red}\n", ["content-encoding", ""])
}

/** The cache follows the disk: a rewrite is served new, a removal is not found. */
const changedChecks = (t: Suite, rig: StaticRig, key: Secret<u8[]>): void => {
  const port: i32 = rig.h2.h1Port
  const first: string = h1(rig, key, port, "GET", "/static/data.json", "")
  expect(t, "data.json served, and cached", first, "200", `{"v":1}\n`, [])
  expect(t, "again from the cache", h1(rig, key, port, "GET", "/static/data.json", ""), "200", `{"v":1}\n`, [])
  writeFileSync(`${WWW}/data.json`, `{"v":22}\n`)
  const second: string = h1(rig, key, port, "GET", "/static/data.json", "")
  expect(t, "changed file: rewritten, the new bytes are served", second, "200", `{"v":22}\n`, ["content-length", "9"])
  t.ok("changed file: with a new ETag", fieldOf(second, "etag") !== fieldOf(first, "etag") && fieldOf(second, "etag").startsWith(`"9-`))
  expect(t, "changed file: the old ETag no longer matches", h1(rig, key, port, "GET", "/static/data.json", `If-None-Match: ${fieldOf(first, "etag")}\r\n`), "200", `{"v":22}\n`, [])
  unlinkSync(`${WWW}/data.json`)
  const gone: string = h1(rig, key, port, "GET", "/static/data.json", "")
  t.ok("changed file: removed, it is not found", statusOf(gone) === "404" && !rig.files.refused)
}

// ---- HTTP/2, HTTP/3 and the handler ------------------------------------------------

/** The four requests every other carrier is asked, on streams 1, 3, 5 and 7: a type, a range, a 304 and a traversal. */
const fourRequests = (wire: Wire, etag: string): void => {
  const none: i32[] = []
  const noValues: i64[] = []
  wire.preface()
  wire.settings(none, noValues)
  wire.settingsAck()
  wire.headers(n32(1), getOf("/static/site.css"), H2_FLAG_END_STREAM)
  const range: string[] = getOf("/static/site.css")
  range.push("range")
  range.push("bytes=5-9")
  wire.headers(n32(3), range, H2_FLAG_END_STREAM)
  const conditional: string[] = getOf("/static/site.css")
  conditional.push("if-none-match")
  conditional.push(etag)
  wire.headers(n32(5), conditional, H2_FLAG_END_STREAM)
  wire.headers(n32(7), getOf("/static/%2e%2e/outside.txt"), H2_FLAG_END_STREAM)
}

/** The frames of `fourRequests`' answers, checked. */
const h2Answers = (t: Suite, name: string, frames: string): void => {
  t.ok(`${name}: a GET of site.css, 200 as text/css with its body`, frames.indexOf("HEADERS 1 :status=200 ") >= 0 && frames.indexOf(" content-type=text/css; charset=utf-8 ") >= 0 && frames.indexOf(`DATA 1 16 "body{color:red}\n"`) >= 0)
  t.ok(`${name}: a range, 206 with its Content-Range`, frames.indexOf("HEADERS 3 :status=206 ") >= 0 && frames.indexOf("content-range=bytes 5-9/16") >= 0 && frames.indexOf(`DATA 3 5 "color"`) >= 0)
  t.ok(`${name}: If-None-Match, 304 with no body`, frames.indexOf("HEADERS 5 end :status=304 ") >= 0 && frames.indexOf("DATA 5 ") < 0)
  t.ok(`${name}: a traversal, 404`, frames.indexOf("HEADERS 7 :status=404 ") >= 0 && frames.indexOf("outside") < 0)
}

const h2Checks = (t: Suite, rig: StaticRig, key: Secret<u8[]>, etag: string): void => {
  const h2 = new H2TlsClient(rig)
  t.ok("HTTP/2 over TLS: the handshake, h2", h2.handshake(rig.h2.port, key) && h2.verified)
  fourRequests(h2.wire, etag)
  h2.flush(key, null, null)
  h2Answers(t, "HTTP/2 over TLS", h2.awaitFrames(n32(13), key, null, null))
}

const h2cChecks = (t: Suite, rig: StaticRig, key: Secret<u8[]>, etag: string): void => {
  const c = new H2cClient(rig)
  t.ok("h2c: a connection", c.connect(rig.h2.h2cPort))
  fourRequests(c.wire, etag)
  c.flush(key)
  h2Answers(t, "h2c", c.awaitFrames(n32(13), key))
}

/** The HEADERS frame of an HTTP/3 GET of `path` with `names`/`values`. */
const h3Get = (path: string, names: string[], values: string[]): u8[] => {
  const allNames: string[] = [":method", ":scheme", ":authority", ":path"]
  const allValues: string[] = ["GET", "https", "localhost", path]
  for (let k: i32 = 0; k < toI32(names.length) && k < toI32(values.length); k++) {
    allNames.push(names[k])
    allValues.push(values[k])
  }
  return h3Frame(H3_FRAME_HEADERS, h3Section(new QpackEncoder(), allNames, allValues))
}

const h3Checks = (t: Suite, rig: StaticRig, key: Secret<u8[]>, etag: string): void => {
  const h3 = new QuicClient(rig)
  t.ok("HTTP/3: the handshake, h3", h3.connect("h3", h3ClientParams(new H3Limits()), key))
  h3.send(CLIENT_CONTROL, h3Cat([h3Varint(H3_STREAM_CONTROL), h3ClientSettings(n64(-1))]), false)
  h3.send(CLIENT_ENCODER, h3Varint(H3_STREAM_QPACK_ENCODER), false)
  h3.send(CLIENT_DECODER, h3Varint(H3_STREAM_QPACK_DECODER), false)
  const none: string[] = []
  h3.send(n64(0), h3Get("/static/site.css", none, none), true)
  h3.turnUntil(key, n64(0), false)
  const css = h3Answer(h3.stream(n64(0)))
  t.eqStr("HTTP/3: a GET of site.css, 200 as text/css with its body", `${css.status} ${css.body} ${css.fields.indexOf("content-type=text/css; charset=utf-8") >= 0}`, "200 body{color:red}\n true")
  h3.send(n64(4), h3Get("/static/site.css", ["range"], ["bytes=5-9"]), true)
  h3.turnUntil(key, n64(4), false)
  const range = h3Answer(h3.stream(n64(4)))
  t.eqStr("HTTP/3: a range, 206 with its Content-Range", `${range.status} ${range.body} ${range.fields.indexOf("content-range=bytes 5-9/16") >= 0}`, "206 color true")
  h3.send(n64(8), h3Get("/static/site.css", ["if-none-match"], [etag]), true)
  h3.turnUntil(key, n64(8), false)
  const same = h3Answer(h3.stream(n64(8)))
  t.eqStr("HTTP/3: If-None-Match, 304 with no body", `${same.status} ${same.body}`, "304 ")
  h3.send(n64(12), h3Get("/static/%2e%2e/outside.txt", none, none), true)
  h3.turnUntil(key, n64(12), false)
  const out = h3Answer(h3.stream(n64(12)))
  t.ok("HTTP/3: a traversal, 404", out.status === "404" && out.body.indexOf("outside") < 0)
  const br = h3Get("/static/app.js", ["accept-encoding"], ["br"])
  h3.send(n64(16), br, true)
  h3.turnUntil(key, n64(16), false)
  const coded = h3Answer(h3.stream(n64(16)))
  t.eqStr("HTTP/3: app.js.br as br", `${coded.status} ${coded.body} ${coded.fields.indexOf("content-encoding=br") >= 0}`, "200 BR-js true")
}

/** The same requests through `serveHandler`, on the handler's own listener. */
const handlerChecks = (t: Suite, rig: StaticRig, key: Secret<u8[]>, etag: string): void => {
  const port: i32 = rig.handlerPort
  expect(t, "handler: a GET of site.css, 200 as text/css", h1(rig, key, port, "GET", "/static/site.css", ""), "200", "body{color:red}\n", ["content-type", "text/css; charset=utf-8", "etag", etag])
  expect(t, "handler: a range, 206", h1(rig, key, port, "GET", "/static/site.css", "Range: bytes=5-9\r\n"), "206", "color", ["content-range", "bytes 5-9/16"])
  expect(t, "handler: If-None-Match, 304", h1(rig, key, port, "GET", "/static/site.css", `If-None-Match: ${etag}\r\n`), "304", "", [])
  expect(t, "handler: bad Range, 416", h1(rig, key, port, "GET", "/static/site.css", "Range: bytes=99-\r\n"), "416", "", ["content-range", "bytes */16"])
  expect(t, "handler: app.js.gz as gzip", h1(rig, key, port, "GET", "/static/app.js", "Accept-Encoding: gzip\r\n"), "200", "GZ-js!", ["content-encoding", "gzip", "vary", "accept-encoding"])
  expect(t, "handler: HEAD", h1(rig, key, port, "HEAD", "/static/site.css", ""), "200", "", ["content-length", "16"])
  const r: string = h1(rig, key, port, "GET", "/static/../outside.txt", "")
  t.ok("handler: a traversal, 404 and refused", statusOf(r) === "404" && rig.files.refused && r.indexOf("outside") < 0)
  const big: string = h1(rig, key, port, "GET", "/static/big.bin", "")
  t.ok("handler: a file past the cache streams whole", statusOf(big) === "200" && toI32(bodyOf(big).length) === BIG)
  rig.tryMode = true
  expect(t, "tryServeHandler: a GET of site.css, Ok and 200", h1(rig, key, port, "GET", "/static/site.css", ""), "200", "body{color:red}\n", ["etag", etag])
  t.eqStr("tryServeHandler: a second answer to it is an Err", rig.again, "HttpHandler.start: the request is not one taken and unanswered (state 0)")
  rig.again = ""
  expect(t, "tryServeHandler: a range, Ok and 206", h1(rig, key, port, "GET", "/static/site.css", "Range: bytes=5-9\r\n"), "206", "color", ["content-range", "bytes 5-9/16"])
  t.eqStr("tryServeHandler: a second answer to the range is an Err", rig.again, "HttpHandler.start: the request is not one taken and unanswered (state 0)")
  rig.again = ""
  const missing: string = h1(rig, key, port, "GET", "/static/nothing-here.txt", "")
  t.eqStr("tryServeHandler: a file that is not there, Ok(STATIC_NOT_FOUND) and refused", `${statusOf(missing)} ${rig.last === STATIC_NOT_FOUND} [${rig.again}]`, "404 true []")
  rig.tryMode = false
}

/** Limits out of range leave the root empty, so nothing is served, rather than panicking. */
const limitChecks = (t: Suite): void => {
  const none = new StaticLimits()
  none.maxEntries = 0
  t.ok("limits out of range: no entries, nothing served", new StaticFiles(WWW, none).root === "")
  const long = new StaticLimits()
  long.maxPath = 4097
  t.ok("limits out of range: a path past 4096, nothing served", new StaticFiles(WWW, long).root === "")
  const negative = new StaticLimits()
  negative.maxCachedBytes = -1
  t.ok("limits out of range: a negative cache, nothing served", new StaticFiles(WWW, negative).root === "")
  const huge = new StaticLimits()
  huge.maxCachedBytes = 1073741825
  t.ok("limits out of range: a cache past 2^30, nothing served", new StaticFiles(WWW, huge).root === "")
  t.ok("limits in range: the root resolves", new StaticFiles(WWW, new StaticLimits()).root !== "")
}

export const main = (): i32 => {
  const t = new Suite("static files")
  writeFixtures()
  const key: Secret<u8[]> = secret(leafPrivate())
  const limits = new StaticLimits()
  limits.maxCachedBytes = 4096
  const rig = new StaticRig(limits)
  // Changed after the files were made: they keep the copy they were given, so
  // the cache does not walk past the entries it sized and siblings stay on.
  limits.maxEntries = 4096
  limits.maxPath = 4096
  limits.precompressed = false
  t.ok("the server listens on every carrier, and the handler beside it", rig.h2.h1Port > 0 && rig.h2.h2cPort > 0 && rig.h2.port > 0 && rig.quicPort > 0 && rig.handlerPort > 0)
  typeChecks(t, rig, key)
  h1Checks(t, rig, key)
  sameSecondCheck(t, rig, key)
  traversalChecks(t, rig, key)
  precompressedChecks(t, rig, key)
  changedChecks(t, rig, key)
  const etag: string = fieldOf(h1(rig, key, rig.h2.h1Port, "GET", "/static/site.css", ""), "etag")
  h2Checks(t, rig, key, etag)
  h2cChecks(t, rig, key, etag)
  h3Checks(t, rig, key, etag)
  handlerChecks(t, rig, key, etag)
  limitChecks(t)
  wipe(key)
  return t.done()
}
