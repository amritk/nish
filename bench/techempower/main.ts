// The TechEmpower json and plaintext entry: `tfbMain` of server.ts, one
// `pollWait` loop over a `TfbServer` in each of one process a core, the
// workers of `nish/net/prefork` sharing one `SO_REUSEPORT` port. See README.md.
//
// Usage: main <port> [nodelay] [host] [slots] [workers]. `nodelay` is 1 (the
// default) or 0; `host` defaults to 127.0.0.1, and the container passes
// 0.0.0.0; `slots` defaults to 16384, TFB's largest plaintext concurrency, and
// is each worker's; `workers` is 0 (the default) for one a core, 1 for one
// process, or the count (`NISH_WORKERS` overrides any but 1). Each worker
// prints `listening <port>` once its pool is built, as the HTTP twins do, and
// serves until SIGINT or SIGTERM, then exits 0.
import { TfbServer, tfbMain } from "./server"

export const main = (): i32 =>
  tfbMain(
    process.argv,
    1,
    (worker: i32, port: i32): void => {
      console.log(`listening ${port}`)
    },
    (worker: i32, tfb: TfbServer): void => {
      // A stopped worker has nothing to report.
    }
  )
