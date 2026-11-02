// The TechEmpower database entry: the `TfbDb` of db-server.ts on one
// process a core, each worker its own handler, pool and carrier. With more
// than one worker the supervisor binds one `SO_REUSEPORT` listener a worker,
// pins worker k to CPU k and steers each connection to the worker on the CPU
// that received it (`pin`); one process binds its own. See README.md.
//
// Usage: db-main <pgPort> <user> <password> <database> [port] [host]
// [pgHost] [workers] [connections]. `port` defaults to 8080 and `host` to
// 127.0.0.1 (the container passes 0.0.0.0); `pgHost` is a numeric address or
// a Unix socket path, 127.0.0.1 by default, since the carrier resolves no
// names; `workers` is 1 (the default) for one process, 0 for one a core, or
// the count (`NISH_WORKERS` overrides it); `connections` is each worker's
// Postgres connections, 4 by default. Each worker prints `listening <port>`
// once its handler is built and serves until SIGINT or SIGTERM, then exits 0.
import { tcpListenFlags } from "nish:net"
import { signalFd } from "nish:process"
import { secret, wipe } from "nish:secret"
import { PgConfig, PgPool, pgTarget } from "nish/net/postgres"
import { PreforkConfig, preforkArgs, preforkListener, preforkWith } from "nish/net/prefork"
import { TFB_QUERY_ROOM, TfbDb, tfbAscii } from "./db-server"

/** `SO_REUSEPORT` and `TCP_NODELAY` on every accepted socket, for one process. */
const LISTEN_FLAGS: i32 = 3
/** `TCP_NODELAY`, for the supervisor's listeners, which add `SO_REUSEPORT` themselves. */
const PREFORK_FLAGS: i32 = 2
/** The listen backlog. */
const BACKLOG: i32 = 4096
/** The signal descriptor's watch id; the carrier's socket is 0. */
const SIGNAL: i32 = 1
/** Connections each worker holds open, TFB's largest database concurrency being 512. */
const SLOTS: i32 = 1024
/** How long a turn waits with nothing to do. */
const IDLE_MS: i32 = 1000

const arg = (args: string[], k: i32, fallback: string): string =>
  toI32(args.length) > k ? args[k] : fallback

export const main = (): i32 => {
  const all: string[] = process.argv
  const workersArg: string = toI32(all.length) > 8 ? all[8] : "1"
  const workers: i32 = parseInt(workersArg)
  let args: string[] = all
  let listener: i32 = -1
  if (workers !== 1) {
    const config = new PreforkConfig()
    config.workers = workers
    config.listenPort = parseInt(arg(all, 5, "8080"))
    config.listenHost = arg(all, 6, "127.0.0.1")
    config.listenBacklog = BACKLOG
    config.listenFlags = PREFORK_FLAGS
    config.pin = true
    const worker: i32 = preforkWith(all, config)
    if (worker < 0) {
      return worker === -1 ? 0 : 1
    }
    args = preforkArgs(all)
    listener = preforkListener(all)
  }
  if (toI32(args.length) < 5) {
    console.log(
      "usage: db-main <pgPort> <user> <password> <database> [port] [host] [pgHost] [workers] [connections]"
    )
    return 2
  }
  const pgPort: i32 = parseInt(arg(args, 1, "5432"))
  const port: i32 = parseInt(arg(args, 5, "8080"))
  const host: string = arg(args, 6, "127.0.0.1")
  const pgHost: string = arg(args, 7, "127.0.0.1")
  const connections: i32 = parseInt(arg(args, 9, "4"))
  if (workers === 1) {
    listener = tcpListenFlags(host, port, BACKLOG, LISTEN_FLAGS)
  }
  if (listener < 0) {
    console.log(`listen failed ${listener}`)
    return 1
  }
  const config = new PgConfig()
  config.user = arg(args, 2, "")
  config.database = arg(args, 4, "")
  config.maxInFlight = 1024
  const password = secret(tfbAscii(arg(args, 3, "")))
  const pool = new PgPool(config, password, connections, 65536)
  wipe(password)
  const db = new TfbDb(listener, SLOTS, pool, pgTarget(pgHost, pgPort), TFB_QUERY_ROOM)
  db.h.watch(signalFd(), SIGNAL)
  console.log(`listening ${port}`)
  while (true) {
    db.turn(IDLE_MS)
    if (db.h.fired(SIGNAL)) {
      return 0
    }
  }
}
