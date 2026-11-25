// The server for the façade's ring measurement (WP71 S3;
// bench/http-server-ring/run.sh; docs/BENCHMARKS.md, "io_uring under the
// http-server façade"): `nish/net/http-server` serving HttpArena's latency
// route over HTTP/1.1, one process, on a listener it opens itself.
//
//   GET /baseline11?a=<n>&b=<n>  the decimal sum a + b as text/plain, read
//                                with `HttpServerRequest.query`
//   anything else                404, or 405 with its Allow
//
// Usage: server <port> <slots> <ring>. With <ring> 1 the listener is opened
// with `tcpListenFlags` flag 8 (`NET_LISTEN_RING`), so its connections live
// in io_uring slots; with 0 it is opened with flag 0, on descriptors. It
// prints `listening <port> rings <netRingState()>` once the server is built
// (1 when the kernel took rings, 0 when it was not asked) and serves until it
// is killed.
import { NET_LISTEN_RING, netRingState, tcpListenFlags } from "nish:net"
import { HttpServer, HttpServerLimits, HttpServerRequest } from "nish/net/http-server"
import { Http1Config } from "nish/net/http1-server"
import { Router, RouterLimits } from "nish/net/router"

/** The most requests the server holds at once: room for one on each of 1,024 connections, twice over. */
const REQUESTS: i32 = 2048
/** How long one `wait` blocks with nothing ready, in milliseconds. */
const WAIT_MS: i32 = 100

/** The decimal digits in `buf[0 .. len)` as a number; a non-digit counts as 0. */
const decimal = (buf: u8[], len: i32): i32 => {
  let v: i32 = 0
  for (let k: i32 = 0; k < len && k < toI32(buf.length); k++) {
    const d: i32 = toI32(buf[k]) - 48
    v = v * 10 + (d >= 0 && d <= 9 ? d : 0)
  }
  return v
}

/** The decimal digits of a string argument. */
const argNumber = (s: string): i32 => {
  let v: i32 = 0
  for (let i: i32 = 0; i < s.length; i += 1) {
    v = v * 10 + toI32(s.charCodeAt(i)) - 48
  }
  return v
}

/** Writes `v`, at least 0, as decimal digits into `out` from 0; returns how many. */
const digits = (v: i32, out: u8[]): i32 => {
  let n: i32 = 0
  let rest: i32 = v > 0 ? v : 0
  do {
    out[n] = toU8(48 + (rest % 10))
    rest = toI32(rest / 10)
    n += 1
  } while (rest > 0 && n < toI32(out.length))
  // The digits went in least significant first: reverse them.
  for (let i: i32 = 0; i < toI32(n / 2); i++) {
    const t: u8 = out[i]
    out[i] = out[n - 1 - i]
    out[n - 1 - i] = t
  }
  return n
}

/** `text` as bytes: ASCII only. */
const bytes = (text: string): u8[] => {
  const out: u8[] = new Array<u8>(toI32(text.length))
  for (let k: i32 = 0; k < toI32(out.length); k++) {
    out[k] = toU8(text.charCodeAt(k))
  }
  return out
}

export const main = (): i32 => {
  const argv: string[] = process.argv
  if (argv.length < 4) {
    console.log("usage: server <port> <slots> <ring 0|1>")
    return 2
  }
  const port: i32 = argNumber(argv[1])
  const slots: i32 = argNumber(argv[2])
  const ring: boolean = argv[3] === "1"
  const listener: i32 = tcpListenFlags("127.0.0.1", port, 4096, ring ? NET_LISTEN_RING : 0)
  if (listener < 0) {
    console.log(`listen failed: ${listener}`)
    return 1
  }
  const router = new Router(new RouterLimits())
  const BASELINE: i32 = router.add("GET", "/baseline11")
  const limits = new HttpServerLimits()
  limits.requests = REQUESTS
  const server = new HttpServer(limits, router)
  server.listenHttp1(listener, new Http1Config(), slots)
  console.log(`listening ${port} rings ${netRingState()}`)
  const textPlain: u8[] = bytes("text/plain")
  const value: u8[] = new Array<u8>(16)
  const body: u8[] = new Array<u8>(16)
  while (true) {
    server.wait(WAIT_MS)
    while (server.ready()) {
      const r: HttpServerRequest = server.take()
      if (r.route === BASELINE) {
        const a: i32 = decimal(value, r.query("a", value))
        const b: i32 = decimal(value, r.query("b", value))
        server.send(r, 200, textPlain, body, 0, digits(a + b, body))
      } else {
        server.refuse(r)
      }
    }
  }
}
