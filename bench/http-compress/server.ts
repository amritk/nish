// The server for `bench/http-compress/run.mjs`: one `Http1Server` on plain
// TCP, one readiness loop, answering `GET /<k>` with body file k, compressed
// or not under one setting of `HttpCompressor`:
//
//   none       no compression: `respond` and `write`, as before it existed
//   level      every body gzipped by `GzipCompressor` at DEFLATE_FAST
//              (`encoder = HTTP_ENCODER_LEVEL`, `minLength` 0): compress always,
//              as the module did before its policy
//   always     every body gzipped, the encoder picked by size
//   threshold  bodies of 1024 bytes or more gzipped
//   segment    every body gzipped, sent so only when the response, head
//              included, takes fewer TCP segments of 1448 bytes
//
// `GET /stats` answers the count of each `HttpCompressor.decision` so far,
// `HTTP_COMPRESS_SENT` first, separated by spaces.
//
// Usage: server <port> <setting> <body>... It prints `listening <port>` once
// it listens and serves until it is killed.
import { pollAdd, pollCreate, pollModify, pollWait, tcpListenFlags } from "nish:net"
import { readFileBytesSync } from "nish:fs"
import { DEFLATE_FAST } from "nish/compress/deflate"
import { HTTP_ENCODER_LEVEL, HttpCompressor } from "nish/net/http-compress"
import {
  H1_DONE,
  H1_ERROR,
  H1_NEED_MORE,
  H1_POOL_FULL,
  H1_REQUEST,
  H1_WANT_READ,
  H1_WANT_WRITE,
  Http1Config,
  Http1Server,
} from "nish/net/http1-server"

/** The listener's token; a connection's token is its slot. */
const LISTENER: i32 = -1
const OK: i32 = 200
const NOT_FOUND: i32 = 404

const bytesOf = (s: string): u8[] => {
  const out: u8[] = new Array<u8>(s.length)
  for (let k: i32 = 0; k < toI32(s.length) && k < toI32(out.length); k++) {
    out[k] = toU8(s.charCodeAt(k))
  }
  return out
}

/** The body index `head[start + 1 .. end)` spells after its `/`, or -1. */
const indexOf = (head: u8[], start: i32, end: i32): i32 => {
  if (end - start < 2 || end - start > 6) {
    return -1
  }
  let k: i32 = 0
  for (let i: i32 = start + 1; i < end && i >= 0 && i < toI32(head.length); i++) {
    const c: i32 = toI32(head[i])
    if (c < 48 || c > 57) {
      return -1
    }
    k = k * 10 + c - 48
  }
  return k
}

export const main = (): i32 => {
  if (process.argv.length < 4) {
    console.log("usage: server <port> <none|level|always|threshold|segment> <body>...")
    return 2
  }
  const port: i32 = parseInt(process.argv[1])
  const setting: string = process.argv[2]
  const bodies: u8[][] = []
  for (let f: i32 = 3; f < process.argv.length; f++) {
    const read: u8[] | null = readFileBytesSync(process.argv[f])
    if (read === null) {
      console.error(`cannot read ${process.argv[f]}`)
      return 1
    }
    bodies.push(read)
  }
  const compress: boolean = setting !== "none"
  const enc: HttpCompressor = new HttpCompressor(DEFLATE_FAST, setting === "threshold" ? 1024 : 0, 65536)
  if (setting === "level") {
    enc.encoder = HTTP_ENCODER_LEVEL
  } else if (setting === "segment") {
    enc.segmentMode = true
  } else if (setting !== "none" && setting !== "always" && setting !== "threshold") {
    console.error(`unknown setting ${setting}`)
    return 2
  }
  const decisions: i32[] = [0, 0, 0, 0, 0, 0]

  const listener: i32 = tcpListenFlags("127.0.0.1", port, 1024, 0)
  if (listener < 0) {
    console.error(`listen failed ${listener}`)
    return 1
  }
  const server = new Http1Server(new Http1Config(), listener, 64)
  const loop: i32 = pollCreate()
  const ready: i32[] = new Array<i32>(128)
  const names: u8[][] = [bytesOf("content-type")]
  const values: u8[][] = [bytesOf("application/json")]
  const plainNames: u8[][] = [bytesOf("content-type")]
  const plainValues: u8[][] = [bytesOf("text/plain")]
  pollAdd(loop, listener, H1_WANT_READ, LISTENER)
  console.log(`listening ${port}`)
  while (true) {
    const n: i32 = pollWait(loop, ready, -1)
    for (let k: i32 = 0; k < n; k++) {
      const slot: i32 = ready[2 * k]
      if (slot === LISTENER) {
        let next: i32 = server.accept()
        while (next >= 0 || next === H1_POOL_FULL) {
          if (next >= 0) {
            pollAdd(loop, server.fd(next), H1_WANT_READ, next)
          }
          next = server.accept()
        }
      } else if (server.holds(slot)) {
        let wants: i32 = (ready[2 * k + 1] & 5) !== 0 ? server.readable(slot) : server.writable(slot)
        let event: i32 = server.next(slot)
        while (event !== H1_NEED_MORE && event !== H1_ERROR) {
          if (event === H1_REQUEST) {
            const conn = server.connection(slot)
            const p = conn.parser
            const i: i32 = indexOf(p.head, p.targetStart, p.targetEnd)
            if (p.targetIs("/stats")) {
              const text: u8[] = bytesOf(
                `${decisions[0]} ${decisions[1]} ${decisions[2]} ${decisions[3]} ${decisions[4]} ${decisions[5]}\n`
              )
              conn.respond(OK, plainNames, plainValues, toI32(text.length))
              conn.write(text, 0, toI32(text.length))
              conn.end()
            } else if (i < 0 || i >= toI32(bodies.length)) {
              conn.respond(NOT_FOUND, plainNames, plainValues, 0)
              conn.end()
            } else if (!compress) {
              const body: u8[] = bodies[i]
              conn.respond(OK, names, values, toI32(body.length))
              conn.write(body, 0, toI32(body.length))
              conn.end()
            } else {
              const body: u8[] = bodies[i]
              const r: i32 = conn.respondEncoded(
                OK,
                names,
                values,
                body,
                0,
                toI32(body.length),
                enc,
                conn.acceptEncoding()
              )
              if (r !== 0) {
                console.error(`respondEncoded: ${r}`)
                return 1
              }
              const d: i32 = enc.decision
              if (d >= 0 && d < toI32(decisions.length)) {
                decisions[d] += 1
              }
            }
          }
          event = server.next(slot)
        }
        wants = server.flush(slot)
        if ((wants & H1_DONE) !== 0) {
          server.close(slot)
        } else if (server.rearm(slot, wants)) {
          pollModify(loop, server.fd(slot), wants & (H1_WANT_READ | H1_WANT_WRITE), slot)
        }
      }
    }
  }
}
