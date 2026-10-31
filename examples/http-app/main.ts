// A small JSON API over `nish/net/handler`: notes kept in memory, routed
// through `nish/net/router`, one log line a request, and a graceful stop on
// SIGINT or SIGTERM.
//
//     build/nish examples/http-app/main.ts --link build/http-app
//     build/http-app 8080 --max-notes 100 &
//     curl -s localhost:8080/health                          # {"status":"ok","notes":0}
//     curl -s -d '{"text":"milk"}' localhost:8080/notes      # {"id":1,"text":"milk"}
//     curl -s localhost:8080/notes                           # [{"id":1,"text":"milk"}]
//     curl -s localhost:8080/notes/1                         # {"id":1,"text":"milk"}
//     curl -s -X DELETE localhost:8080/notes/1               # 204
//     kill %1                                                # drains, then exits 0
//
// On the first signal it stops accepting, answers what it holds and waits for
// open connections to finish, for `--drain-ms` at most; a second signal stops
// it at once. Unknown paths and methods are RFC 9457 problems (404, or 405
// with its `Allow`). Without a port it prints how to run it and exits 2.
// smoke: exit 2
import { HttpHandler, HandlerLimits } from "nish/net/handler"
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
  console.error("usage: http-app <port> [--max-notes <n>] [--drain-ms <ms>] [--quiet]")
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
  const h = new HttpHandler(new HandlerLimits(), listener, router)
  h.watch(signals, SIGNALS)
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
  const deadline: i64 = monotonicNanos() + toI64(config.drainMs) * NANOS_PER_MS
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
