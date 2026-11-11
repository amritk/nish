// An HTTP/1.1 server that answers every request with one file, streamed a
// window at a time (WP44, #710). The file is opened once at start-up; each
// connection keeps only how far into it it has got, an i64, and every
// connection reads through the same 64 KiB window. So memory follows the
// window and not the file: a 4 GiB video costs what a 64 KiB one does.
//
//     build/nish examples/file-server.ts --link build/file-server
//     build/file-server big.mp4 8080 &
//     curl -s http://127.0.0.1:8080/ | cmp - big.mp4
//     kill %1
//
// Port 0 lets the kernel pick one; the first line printed names it. The
// response carries a Content-Length, which `respond` takes as an i32, so a
// file past 2^31 - 1 bytes is refused at start-up. Without a path and a port
// it prints how to run it and exits 2.
// smoke: exit 2
import { fileOpen, fileReadAt, fileSize } from "nish:fs"
import { netLocalPort, pollAdd, pollCreate, pollModify, pollWait, tcpListen } from "nish:net"
import {
  H1_AGAIN,
  H1_DONE,
  H1_END,
  H1_ERROR,
  H1_NEED_MORE,
  H1_POOL_FULL,
  H1_WANT_READ,
  H1_WANT_WRITE,
  H1_WRITE,
  Http1Config,
  Http1Connection,
  Http1Server,
} from "nish/net/http1-server"

/** The listener's token; a connection's token is its slot. */
const LISTENER: i32 = -1
/** How much of the file is read at once: the only buffer the body passes through. */
const WINDOW: i32 = 65536
/** A slot's position while it is not answering a request. */
const IDLE: i64 = -1
/** A slot's position while its response head waits for room in the output. */
const HEAD_OWED: i64 = -2
const OK: i32 = 200

const bytesOf = (s: string): u8[] => {
  const out: u8[] = new Array<u8>(s.length)
  for (let k: i32 = 0; k < toI32(s.length) && k < toI32(out.length); k++) {
    out[k] = toU8(s.charCodeAt(k))
  }
  return out
}

/** The file every response carries, opened once, and the window it is read through. */
class Served {
  file: i32
  size: i64
  window: u8[]
  names: u8[][]
  values: u8[][]

  constructor(file: i32, size: i64) {
    this.file = file
    this.size = size
    this.window = new Array<u8>(WINDOW)
    this.names = [bytesOf("Content-Type")]
    this.values = [bytesOf("application/octet-stream")]
  }
}

/**
 * Moves one connection's response on from `at` until the output is full or
 * the body is sent, and answers where it got to: `IDLE` once the response is
 * over, else the position to pump from on the connection's next `H1_WRITE`.
 * A read that comes back short of the planned size means the file shrank
 * under the server (or failed); the Content-Length can no longer be met, so
 * the connection is aborted rather than left owing bytes.
 */
const pump = (conn: Http1Connection, served: Served, at: i64): i64 => {
  let pos: i64 = at
  if (pos === HEAD_OWED) {
    const head: i32 = conn.respond(OK, served.names, served.values, toI32(served.size))
    if (head === H1_AGAIN) {
      return HEAD_OWED
    }
    if (head < 0) {
      conn.abort()
      return IDLE
    }
    if (conn.parser.methodIs("HEAD")) {
      conn.end()
      return IDLE
    }
    pos = 0
  }
  while (pos < served.size) {
    const left: i64 = served.size - pos
    const want: i32 = left < toI64(WINDOW) ? toI32(left) : WINDOW
    const n: i32 = fileReadAt(served.file, served.window, toI32(0), want, pos)
    if (n <= 0) {
      conn.abort()
      return IDLE
    }
    const took: i32 = conn.write(served.window, toI32(0), n)
    if (took === H1_AGAIN) {
      return pos
    }
    if (took < 0) {
      conn.abort()
      return IDLE
    }
    pos = pos + toI64(took)
    if (took < n) {
      // The rest of this window is read again on the next H1_WRITE.
      return pos
    }
  }
  conn.end()
  return IDLE
}

const serve = (served: Served, listener: i32): i32 => {
  const server = new Http1Server(new Http1Config(), listener, 64)
  const at: i64[] = new Array<i64>(server.size())
  for (let k: i32 = 0; k < toI32(at.length); k++) {
    at[k] = IDLE
  }
  const loop: i32 = pollCreate()
  const ready: i32[] = new Array<i32>(128)
  pollAdd(loop, listener, H1_WANT_READ, LISTENER)
  while (true) {
    // No timeout and no idle close: a client that stops reading keeps its
    // slot, one of 64, until it goes away. A real server would time it out.
    const n: i32 = pollWait(loop, ready, -1)
    for (let k: i32 = 0; k < n; k++) {
      const slot: i32 = ready[2 * k]
      if (slot === LISTENER) {
        let next: i32 = server.accept()
        while (next >= 0 || next === H1_POOL_FULL) {
          if (next >= 0 && next < toI32(at.length)) {
            at[next] = IDLE
            pollAdd(loop, server.fd(next), H1_WANT_READ, next)
          }
          next = server.accept()
        }
      } else if (server.holds(slot)) {
        // Only the I/O matters here; `flush` below answers what to wait for next.
        if ((ready[2 * k + 1] & 5) !== 0) {
          server.readable(slot)
        } else {
          server.writable(slot)
        }
        let pos: i64 = IDLE
        if (slot >= 0 && slot < toI32(at.length)) {
          pos = at[slot]
        }
        let event: i32 = server.next(slot)
        while (event !== H1_NEED_MORE && event !== H1_ERROR) {
          if (event === H1_END) {
            pos = pump(server.connection(slot), served, HEAD_OWED)
          } else if (event === H1_WRITE && pos !== IDLE) {
            pos = pump(server.connection(slot), served, pos)
          }
          event = server.next(slot)
        }
        if (slot >= 0 && slot < toI32(at.length)) {
          at[slot] = pos
        }
        const wants: i32 = server.flush(slot)
        if ((wants & H1_DONE) !== 0) {
          server.close(slot)
        } else if (server.rearm(slot, wants)) {
          pollModify(loop, server.fd(slot), wants & (H1_WANT_READ | H1_WANT_WRITE), slot)
        }
      }
    }
  }
}

export const main = (): i32 => {
  const args: string[] = process.argv
  if (args.length < 3) {
    console.log("usage: file-server <path> <port>   (port 0 picks a free one)")
    return 2
  }
  const file: i32 = fileOpen(args[1])
  if (file < 0) {
    console.error(`file-server: cannot open ${args[1]}: ${file}`)
    return 1
  }
  const size: i64 = fileSize(file)
  if (size < 0 || size > toI64(2147483647)) {
    console.error(`file-server: ${args[1]} is ${size} bytes; a Content-Length here holds at most 2^31 - 1`)
    return 1
  }
  const listener: i32 = tcpListen("127.0.0.1", parseInt(args[2]), 1024)
  if (listener < 0) {
    console.error(`file-server: listen failed ${listener}`)
    return 1
  }
  console.log(`serving ${size} bytes on http://127.0.0.1:${netLocalPort(listener)}/`)
  return serve(new Served(file, size), listener)
}
