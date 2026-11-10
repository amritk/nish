// The TechEmpower json and plaintext entry in the async style: `serveOn`
// hands each request to `tfbHandle` of async-server.ts in a task of its own.
// The twin of main.ts, which drives the same answers through an explicit
// `pollWait` loop.
//
// Usage: async-main <port> [nodelay] [host] [slots], as main.ts takes them.
// `nodelay` is 1 (the default) or 0; `host` defaults to 127.0.0.1, and the
// container passes 0.0.0.0; `slots` defaults to 16384, TFB's largest
// plaintext concurrency. It prints `listening <port>` once it listens, and
// serves until SIGINT or SIGTERM, then exits 0.
import { readable, spawn } from "nish:async"
import { tcpListenFlags } from "nish:net"
import { signalFd } from "nish:process"
import { ServeStats, serveOn } from "nish/net/serve"
import { tfbHandle, tfbLimits, tfbRouter } from "./async-server"

/** The `tcpListenFlags` bit the `nodelay` argument sets: `TCP_NODELAY` on every accepted socket. */
const NODELAY_FLAG: i32 = 2

const arg = (k: i32, fallback: string): string =>
  toI32(process.argv.length) > k ? process.argv[k] : fallback

/** Ends the program with 0 once SIGINT or SIGTERM arrives; `serveOn` serves for good otherwise. */
const exitOnSignal = async (fd: i32): Promise<void> => {
  await readable(fd)
  process.exit(0)
}

export const main = async (): Promise<i32> => {
  const port: i32 = parseInt(arg(1, "8080"))
  const nodelay: boolean = arg(2, "1") !== "0"
  const host: string = arg(3, "127.0.0.1")
  const slots: i32 = parseInt(arg(4, "16384"))
  const listener: i32 = tcpListenFlags(host, port, 4096, nodelay ? NODELAY_FLAG : 0)
  if (listener < 0) {
    console.log(`listen failed ${listener}`)
    return 1
  }
  spawn(exitOnSignal(signalFd()))
  console.log(`listening ${port}`)
  return await serveOn(listener, tfbRouter(), tfbLimits(slots), tfbHandle, new ServeStats())
}
