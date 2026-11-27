// Opt-out (`--allow-panics`): it answers through the `try` calls of
// `nish/net/handler`, `nish/net/serve` and `nish/net/static`, and still
// reaches: the cap check of `Http1Connection`'s constructor
// (std/net/http1-server.ts:499:5), through every answer, `wait`, `next` and
// `drain`; the limits panic of the `HttpHandler` constructor
// (std/net/handler.ts:934:7), which `openHttpHandler` calls only once the
// limits passed the same check; `std/net/router`'s contract panics
// (std/net/router.ts:1290:3, :1304:5), through `Router`, `add` and
// `tryRefuse`; and a `nish/net/static` slice (std/net/static.ts:221:20). The
// config and the limits are mutable classes stored as given, and the router's
// panics are not window guards, so no caller's proof discharges them (only a
// guard's window is, the `window` contract in docs/LANGUAGE.md, "Panic
// sites", #2296). Once the panics above are gone, build this program without
// `--allow-panics`.
//
// A small JSON API over `nish/net/handler`: notes kept in memory, routed
// through `nish/net/router`, one log line a request, and a graceful stop on
// SIGINT or SIGTERM. `--static <dir>` serves the files under `dir` at
// `/static/` through `nish/net/static`.
//
//     build/nish --allow-panics examples/http-app/main.ts --link build/http-app
//     build/http-app 8080 --max-notes 100 &
//     curl -s localhost:8080/health                          # {"status":"ok","notes":0}
//     curl -s -d '{"text":"milk"}' localhost:8080/notes      # {"id":1,"text":"milk"}
//     curl -s localhost:8080/notes                           # [{"id":1,"text":"milk"}]
//     curl -s localhost:8080/notes/1                         # {"id":1,"text":"milk"}
//     curl -s -X DELETE localhost:8080/notes/1               # 204
//     kill %1                                                # drains, then exits 0
//
//     build/http-app 8080 --static examples/http-app &
//     curl -s localhost:8080/static/notes.ts                 # the file, with its ETag
//     curl -s -r 0-9 localhost:8080/static/notes.ts          # its first ten bytes, 206
//
// On the first signal it stops accepting, answers what it holds and waits for
// open connections to finish, for `--drain-ms` at most; a second signal stops
// it at once. Unknown paths and methods are RFC 9457 problems (404, or 405
// with its `Allow`). Without a port it prints how to run it and exits 2.
// smoke: args --allow-panics
// smoke: exit 2
import { HttpHandler, HandlerLimits, openHttpHandler } from "nish/net/handler"
import { Router } from "nish/net/router"
import { netClose, tcpListen } from "nish:net"
import { monotonicNanos, readSignal, signalFd } from "nish:process"
import { App, appRoutes, configure, serveTurn } from "./app"

/** The handler's watched-descriptor id for the signal pipe. */
const SIGNALS: i32 = 0
const TURN_MS: i32 = 1000
const DRAIN_TURN_MS: i32 = 100
const NANOS_PER_MS: i64 = 1000000

const usage = (error: string): i32 => {
  console.error(`http-app: ${error}`)
  console.error("usage: http-app <port> [--max-notes <n>] [--drain-ms <ms>] [--static <dir>] [--quiet]")
  console.error("  serves a JSON notes API on <port> until SIGINT or SIGTERM")
  return 2
}

export const main = (): i32 => {
  const config = configure(process.argv)
  if (config.error !== "") {
    return usage(config.error)
  }
  const listener: i32 = tcpListen("0.0.0.0", config.port, 1024)
  if (listener < 0) {
    console.error(`http-app: cannot listen on port ${config.port}: ${listener}`)
    return 1
  }
  // Without the signal pipe SIGINT and SIGTERM would kill the process mid-answer.
  const signals: i32 = signalFd()
  if (signals < 0) {
    console.error("http-app: cannot take SIGINT and SIGTERM")
    netClose(listener)
    return 1
  }
  const router: Router = appRoutes()
  const opened: Result<HttpHandler, string> = openHttpHandler(new HandlerLimits(), listener, router)
  if (opened.isErr()) {
    console.error(`http-app: ${opened.error}`)
    netClose(signals)
    netClose(listener)
    return 1
  }
  const h: HttpHandler = opened.value
  const watched: Result<boolean, string> = h.tryWatch(signals, SIGNALS)
  if (watched.isErr()) {
    console.error(`http-app: ${watched.error}`)
    netClose(signals)
    netClose(listener)
    return 1
  }
  const app = new App(h, config)
  console.log(`http-app: listening on port ${config.port}`)

  let running = true
  while (running) {
    serveTurn(app, TURN_MS)
    if (h.fired(SIGNALS)) {
      readSignal(signals)
      running = false
    }
  }
  console.log(`http-app: stopping, draining ${h.connections()} connections`)
  h.drain()
  // `u64`, which wraps rather than panics, and cannot here: the clock counts
  // from boot and `--drain-ms` has nine digits at most, so the sum stays
  // under 2^60.
  const deadline: i64 = toI64(toU64(monotonicNanos()) + toU64(config.drainMs) * toU64(NANOS_PER_MS))
  let forced = false
  while (h.connections() > 0 && monotonicNanos() < deadline && !forced) {
    serveTurn(app, DRAIN_TURN_MS)
    if (h.fired(SIGNALS)) {
      readSignal(signals)
      forced = true
    }
  }
  netClose(listener)
  console.log(`http-app: stopped with ${h.connections()} connections left`)
  return 0
}
