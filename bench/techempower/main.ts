// The TechEmpower json and plaintext entry: one process, one thread, one
// `pollWait` loop over the `TfbServer` of server.ts. See README.md.
//
// Usage: main <port> [nodelay] [host] [slots]. `nodelay` is 1 (the default)
// or 0; `host` defaults to 127.0.0.1, and the container passes 0.0.0.0;
// `slots` defaults to 16384, TFB's largest plaintext concurrency. It prints
// `listening <port>` once the pool is built, as the HTTP twins do, and serves
// until SIGINT or SIGTERM, then exits 0.
import { pollAdd, pollCreate, pollWait, tcpListenFlags } from "nish:net"
import { signalFd } from "nish:process"
import { TfbServer } from "./server"

/** The `tcpListenFlags` bit the `nodelay` argument sets: `TCP_NODELAY` on every accepted socket. */
const NODELAY_FLAG: i32 = 2
/** The signal descriptor's token in the loop: SIGINT or SIGTERM ends the program. */
const SIGNAL: i32 = -2
/** How many ready descriptors one `pollWait` answers, as token and event pairs. */
const READY: i32 = 256

const arg = (k: i32, fallback: string): string =>
  toI32(process.argv.length) > k ? process.argv[k] : fallback

export const main = (): i32 => {
  const port: i32 = parseInt(arg(1, "8080"))
  const nodelay: boolean = arg(2, "1") !== "0"
  const host: string = arg(3, "127.0.0.1")
  const slots: i32 = parseInt(arg(4, "16384"))
  const listener: i32 = tcpListenFlags(host, port, 4096, nodelay ? NODELAY_FLAG : 0)
  if (listener < 0) {
    console.log(`listen failed ${listener}`)
    return 1
  }
  const loop: i32 = pollCreate()
  const tfb: TfbServer = new TfbServer(loop, listener, slots)
  pollAdd(loop, signalFd(), 1, SIGNAL)
  const ready: i32[] = new Array<i32>(2 * READY)
  console.log(`listening ${port}`)
  while (true) {
    const n: i32 = pollWait(loop, ready, tfb.waitMs())
    // A paused listener is tried again after every wait, a timed-out one included.
    tfb.unpause()
    for (let k: i32 = 0; k < n; k++) {
      if (ready[2 * k] === SIGNAL) {
        return 0
      }
      tfb.dispatch(ready[2 * k], ready[2 * k + 1])
    }
  }
}
