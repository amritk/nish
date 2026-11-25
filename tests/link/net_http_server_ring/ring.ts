// `nish/net/http-server` on io_uring slots (WP71 S3). The program runs itself
// twice. The parent picks a free loopback port and starts its own binary as
// `child <port>` under `ulimit -n 32`, through `/bin/sh`. The child opens the
// façade's listener on that port with `tcpListenFlags` flag 8
// (`NET_LISTEN_RING`) and serves it through `HttpServer.listenHttp1` with
// `SLOTS` slots. The parent, outside the limit, opens `CLIENTS` keep-alive
// connections, more than the child's descriptor limit, each sending one
// `GET /`. The child must hold every one at once and answer each with an
// empty 200: a carrier on descriptors holds fewer than 32 under the limit, so
// only connections that live in ring slots (handles at or above 2^20, a ring
// and its eventfd costing two descriptors per 32 slots) can reach `CLIENTS`.
// The child exits 2 with "rings refused" where the kernel refuses io_uring;
// the parent then exits 2 too, and its `tests/run.js` section counts a skip.
// It is not a `main.ts`, so the generic link runner, which has no skip, does
// not run it.
import { realpathSync } from "nish:fs"
import {
  NET_LISTEN_RING,
  connectResult,
  netAddress,
  netClose,
  netLocalPort,
  netRead,
  netRingState,
  netWrite,
  pollCreate,
  pollWait,
  tcpConnect,
  tcpListen,
  tcpListenFlags,
} from "nish:net"
import { spawn, waitPid } from "nish:process"
import { HttpServer, HttpServerLimits, HttpServerRequest } from "nish/net/http-server"
import { Http1Config } from "nish/net/http1-server"
import { Router, RouterLimits } from "nish/net/router"

/** The connections the parent opens: more than three times the child's descriptor limit. */
const CLIENTS: i32 = 100
/** The child's descriptor limit, set by `ulimit -n`. */
const LIMIT: i32 = 32
/** The façade's HTTP/1.1 slots: room for every client. */
const SLOTS: i32 = 128
/** What `netRead` and `netWrite` answer when the socket is not ready. */
const WOULD_BLOCK: i32 = -11
/** The longest either side waits, in nanoseconds: 60 s. */
const PATIENCE: i64 = 60000000000
/** One `GET /` on a kept-alive connection. */
const REQUEST: string = "GET / HTTP/1.1\r\nHost: t\r\n\r\n"

/** `text` as bytes: ASCII only. */
const bytes = (text: string): u8[] => {
  const out: u8[] = new Array<u8>(toI32(text.length))
  for (let k: i32 = 0; k < toI32(out.length); k++) {
    out[k] = toU8(text.charCodeAt(k))
  }
  return out
}

/** Whether `buf` starts with `text`. */
const startsWith = (buf: u8[], text: string): boolean => {
  if (buf.length < text.length) {
    return false
  }
  for (let k: i32 = 0; k < toI32(text.length); k++) {
    if (k >= toI32(buf.length) || toI32(buf[k]) !== toI32(text.charCodeAt(k))) {
      return false
    }
  }
  return true
}

const selfPath = (): string => {
  const exe: string | null = realpathSync("/proc/self/exe")
  return exe !== null ? exe : process.argv[0]
}

const decimal = (s: string): i32 => {
  let v: i32 = 0
  for (let i: i32 = 0; i < s.length; i += 1) {
    v = v * 10 + toI32(s.charCodeAt(i)) - 48
  }
  return v
}

/** The server: the façade over a ring listener on `port`, under the descriptor limit. */
const child = (port: i32): i32 => {
  const listener: i32 = tcpListenFlags("127.0.0.1", port, 1024, NET_LISTEN_RING)
  if (listener < 0) {
    console.log(`child: listen failed with ${listener}`)
    return 1
  }
  // Only a negative errno is the kernel refusing rings, which the section
  // counts as a skip. Any other state but 1 means the ring listen did not
  // reach the rings, and the case fails.
  const state: i32 = netRingState()
  if (state < 0) {
    console.log(`child: rings refused: ${state}`)
    return 2
  }
  if (state !== 1) {
    console.log(`child: the ring listener left the ring state at ${state}`)
    return 1
  }
  const router = new Router(new RouterLimits())
  const ROOT: i32 = router.add("GET", "/")
  const server = new HttpServer(new HttpServerLimits(), router)
  server.listenHttp1(listener, new Http1Config(), SLOTS)
  let answered: i32 = 0
  let most: i32 = 0
  const deadline: i64 = monotonicNanos() + PATIENCE
  while ((answered < CLIENTS || most < CLIENTS) && monotonicNanos() < deadline) {
    server.wait(20)
    while (server.ready()) {
      const r: HttpServerRequest = server.take()
      if (r.route === ROOT) {
        server.empty(r, 200)
        answered += 1
      } else {
        server.refuse(r)
      }
    }
    const now: i32 = server.connections()
    most = now > most ? now : most
  }
  if (most < CLIENTS || answered < CLIENTS) {
    console.log(`child: held at most ${most} and answered ${answered} of ${CLIENTS} connections`)
    return 1
  }
  // An answer is queued, not yet written: serve on until the parent has read
  // every one and hung up.
  while (server.connections() > 0 && monotonicNanos() < deadline) {
    server.wait(20)
  }
  console.log(`child: held ${most} connections at once under a descriptor limit of ${LIMIT}, and answered each`)
  return 0
}

/** One client of the parent's: its socket, whether its request is out, whether its answer came. */
class Client {
  fd: i32 = -1
  sent: boolean = false
  answered: boolean = false
}

/** Waits about `ms` milliseconds on a loop that watches nothing. */
const pause = (loop: i32, out: i32[], ms: i32): void => {
  pollWait(loop, out, ms)
}

export const main = (): i32 => {
  const argv: string[] = process.argv
  if (argv.length >= 3 && argv[1] === "child") {
    return child(decimal(argv[2]))
  }
  const probe: i32 = tcpListen("127.0.0.1", 0, 1)
  if (probe < 0) {
    console.log(`parent: listen failed with ${probe}`)
    return 1
  }
  const port: i32 = netLocalPort(probe)
  netClose(probe)
  const pid: i32 = spawn(["/bin/sh", "-c", `ulimit -n ${LIMIT} && exec "$0" child "$1"`, selfPath(), `${port}`])
  if (pid <= 0) {
    console.log(`parent: the child could not be started: ${pid}`)
    return 1
  }
  const loop: i32 = pollCreate()
  const out: i32[] = new Array<i32>(8)
  const addr: u8[] = new Array<u8>(18)
  netAddress(addr, "127.0.0.1", port)
  const deadline: i64 = monotonicNanos() + PATIENCE

  // Wait for the child's listener: a connection that is refused is retried.
  // A child that exits first, refused rings or a shell whose `ulimit` failed,
  // ends the wait at once with its status, not at the deadline. Its 2 is
  // passed on; the section reads "rings refused" beside it to skip.
  let ready: boolean = false
  while (!ready && monotonicNanos() < deadline) {
    const early: i32[] = waitPid(pid, 1)
    if (early[0] === pid) {
      console.log(`parent: the child exited with ${early[1]} before it listened`)
      return early[1] === 2 ? 2 : 1
    }
    const fd: i32 = tcpConnect(addr)
    pause(loop, out, 20)
    ready = fd >= 0 && connectResult(fd) === 0
    if (fd >= 0) {
      netClose(fd)
    }
  }

  const clients: Client[] = []
  for (let k: i32 = 0; k < CLIENTS; k++) {
    const c = new Client()
    c.fd = tcpConnect(addr)
    clients.push(c)
  }
  const request: u8[] = bytes(REQUEST)
  const buf: u8[] = new Array<u8>(4096)
  let answered: i32 = 0
  while (answered < CLIENTS && monotonicNanos() < deadline) {
    for (const c of clients) {
      if (!c.sent) {
        c.sent = netWrite(c.fd, request, 0, toI32(request.length)) === toI32(request.length)
      } else if (!c.answered) {
        const n: i32 = netRead(c.fd, buf, 0, toI32(buf.length))
        if (n >= 12 && startsWith(buf, "HTTP/1.1 200")) {
          c.answered = true
          answered += 1
        } else if (n !== WOULD_BLOCK) {
          console.log(`parent: a client read ${n} bytes that are not an answer`)
          return 1
        }
      }
    }
    pause(loop, out, 5)
  }
  for (const c of clients) {
    netClose(c.fd)
  }
  const done: i32[] = waitPid(pid, 0)
  if (answered < CLIENTS) {
    console.log(`parent: ${answered} of ${CLIENTS} clients were answered`)
    return 1
  }
  console.log(`parent: every one of ${CLIENTS} clients was answered`)
  return done[1]
}
