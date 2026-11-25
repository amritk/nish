// The HttpArena entry: `arenaMain` of server.ts, HTTP/1.1 on 8080 and h2c on
// 8082 in each of one worker a core. See README.md.
//
// Usage: main [port] [h2c port] [host] [slots] [workers] [dataset]. Each
// worker prints `listening <port> <h2c port>` once it serves, and serves until
// SIGINT or SIGTERM, then exits 0.
import { ArenaServer, arenaMain } from "./server"

export const main = (): i32 =>
  arenaMain(
    process.argv,
    1,
    (worker: i32, port: i32, h2cPort: i32): void => {
      console.log(`listening ${port} ${h2cPort}`)
    },
    (worker: i32, server: ArenaServer): void => {
      // A stopped worker has nothing to report.
    }
  )
