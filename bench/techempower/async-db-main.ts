// The TechEmpower database entry in the async style: `tfbServeDb` of
// async-db-server.ts hands each request to a handler, in a task of its own,
// that awaits a `PgAsyncPool`. The twin of db-main.ts, which drives the same
// answers through an explicit handler and carrier, and run the same way: one
// process a core with more than one worker, the supervisor binding one
// `SO_REUSEPORT` listener a worker, pinning worker k to CPU k and steering
// each connection to the worker on the CPU that received it (`pin`).
//
// Usage: async-db-main <pgPort> <user> <password> <database> [port] [host]
// [pgHost] [workers] [connections], as db-main.ts takes them: `port` defaults
// to 8080 and `host` to 127.0.0.1; `pgHost` is a numeric address or a Unix
// socket path, 127.0.0.1 by default; `workers` is 1 (the default) for one
// process, 0 for one a core, or the count (`NISH_WORKERS` overrides it);
// `connections` is each worker's Postgres connections, 4 by default, 64 at
// most (more is said and clamped). Each worker prints `listening <port>` once
// at least one connection is made, saying so when fewer than asked were, and
// serves until SIGINT or SIGTERM, then exits 0. While it serves, `main` dials
// again every connection the pool closed, so the pool never shrinks for good.
import { awaitAll, readable, spawn } from "nish:async"
import { tcpListenFlags } from "nish:net"
import { signalFd } from "nish:process"
import { secret, wipe } from "nish:secret"
import { PgConfig, pgTarget } from "nish/net/postgres"
import { PG_ASYNC_MAX_SIZE, PgAsyncPool, pgAsyncConnect } from "nish/net/postgres-async"
import { PreforkConfig, preforkArgs, preforkListener, preforkWith } from "nish/net/prefork"
import { ServeStats } from "nish/net/serve"
import { TfbAsyncDb, tfbDbLimits, tfbKeepPool, tfbServeDbUntil } from "./async-db-server"
import { tfbAscii } from "./db-server"

/** `SO_REUSEPORT` and `TCP_NODELAY` on every accepted socket, for one process. */
const LISTEN_FLAGS: i32 = 3
/** `TCP_NODELAY`, for the supervisor's listeners, which add `SO_REUSEPORT` themselves. */
const PREFORK_FLAGS: i32 = 2
/** The listen backlog. */
const BACKLOG: i32 = 4096
/** Requests each worker holds in flight, TFB's largest database concurrency being 512. */
const SLOTS: i32 = 1024
/** How often `main` looks for a closed connection to dial again, in milliseconds. */
const REDIAL_MS: i32 = 100

const arg = (args: string[], k: i32, fallback: string): string =>
  toI32(args.length) > k ? args[k] : fallback

/** Ends the program with 0 once SIGINT or SIGTERM arrives; `serveOn` serves for good otherwise. */
const exitOnSignal = async (fd: i32): Promise<void> => {
  await readable(fd)
  process.exit(0)
}

export const main = async (): Promise<i32> => {
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
      "usage: async-db-main <pgPort> <user> <password> <database> [port] [host] [pgHost] [workers] [connections]"
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
  // Kept, as `PgPool` keeps its copy, to dial again what the pool closes.
  const password = secret(tfbAscii(arg(args, 3, "")))
  let size: i32 = connections < 1 ? 1 : connections
  if (size > PG_ASYNC_MAX_SIZE) {
    console.log(`connections ${connections} clamped to ${PG_ASYNC_MAX_SIZE}`)
    size = PG_ASYNC_MAX_SIZE
  }
  const pool = new PgAsyncPool(size)
  const target = pgTarget(pgHost, pgPort)
  const connected: i32 = await pgAsyncConnect(pool, config, password, target)
  if (connected < 1) {
    wipe(password)
    console.log("no Postgres connection")
    return 1
  }
  if (connected < size) {
    console.log(`connected ${connected} of ${size} Postgres connections; dialling the rest`)
  }
  const db = new TfbAsyncDb(pool)
  spawn(exitOnSignal(signalFd()))
  console.log(`listening ${port}`)
  const [code, _redialled] = await awaitAll(
    tfbServeDbUntil(listener, db, tfbDbLimits(SLOTS), new ServeStats()),
    tfbKeepPool(db, config, password, target, REDIAL_MS)
  )
  wipe(password)
  return code
}
