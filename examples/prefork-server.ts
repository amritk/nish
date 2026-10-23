// An HTTP/1.1 server on every core: `nish/net/prefork` starts one worker
// process per core, each binds its own SO_REUSEPORT listener on the port, and
// the kernel spreads connections across them. Every response names the worker
// that answered it, so a few `curl`s show the spread:
//
//     build/nish examples/prefork-server.ts --link build/prefork-server
//     build/prefork-server 8080 &
//     curl -s http://127.0.0.1:8080/   # worker 2
//     curl -s http://127.0.0.1:8080/   # worker 0
//     kill %1                          # SIGTERM: every worker stops, exit 0
//
// `NISH_WORKERS=2` starts two workers instead of one a core. Without a port
// it prints how to run it and exits 2.
// smoke: exit 2
import { pollAdd, pollCreate, pollModify, pollWait, tcpListenFlags } from "nish:net"
import {
  H1_DONE,
  H1_END,
  H1_ERROR,
  H1_NEED_MORE,
  H1_POOL_FULL,
  H1_WANT_READ,
  H1_WANT_WRITE,
  Http1Config,
  Http1Server,
} from "nish/net/http1-server"
import { PREFORK_STOPPED, preforkArgs, preforkWorkers } from "nish/net/prefork"

/** The listener's token; a connection's token is its slot. */
const LISTENER: i32 = -1
/** `tcpListenFlags`' SO_REUSEPORT. */
const REUSE_PORT: i32 = 1
const OK: i32 = 200

const bytesOf = (s: string): u8[] => {
  const out: u8[] = new Array<u8>(s.length)
  for (let k: i32 = 0; k < toI32(s.length) && k < toI32(out.length); k++) {
    out[k] = toU8(s.charCodeAt(k))
  }
  return out
}

/** One worker: a readiness loop over its own listener, answering `worker <index>`. */
const serve = (index: i32, port: i32): i32 => {
  const listener: i32 = tcpListenFlags("0.0.0.0", port, 1024, REUSE_PORT)
  if (listener < 0) {
    console.error(`worker ${index}: listen failed ${listener}`)
    return 1
  }
  const server = new Http1Server(new Http1Config(), listener, 256)
  const loop: i32 = pollCreate()
  const ready: i32[] = new Array<i32>(128)
  const body: u8[] = bytesOf(`worker ${index}\n`)
  const names: u8[][] = [bytesOf("Content-Type")]
  const values: u8[][] = [bytesOf("text/plain")]
  pollAdd(loop, listener, H1_WANT_READ, LISTENER)
  while (true) {
    const n: i32 = pollWait(loop, ready, -1)
    for (let k: i32 = 0; k < n; k++) {
      const slot: i32 = ready[2 * k]
      if (slot === LISTENER) {
        let next: i32 = server.accept()
        while (next >= 0 || next === H1_POOL_FULL) {
          if (next >= 0) {
            pollAdd(loop, server.fd(next), H1_WANT_READ, next)
          }
          next = server.accept()
        }
      } else if (server.holds(slot)) {
        let wants: i32 = (ready[2 * k + 1] & 5) !== 0 ? server.readable(slot) : server.writable(slot)
        let event: i32 = server.next(slot)
        while (event !== H1_NEED_MORE && event !== H1_ERROR) {
          if (event === H1_END) {
            const conn = server.connection(slot)
            conn.respond(OK, names, values, toI32(body.length))
            conn.write(body, toI32(0), toI32(body.length))
            conn.end()
          }
          event = server.next(slot)
        }
        wants = server.flush(slot)
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
  const args: string[] = preforkArgs(process.argv)
  if (args.length < 2) {
    console.log("usage: prefork-server <port>   (NISH_WORKERS=<n> for n workers)")
    return 2
  }
  const port: i32 = parseInt(args[1])
  const worker: i32 = preforkWorkers(process.argv)
  if (worker < 0) {
    return worker === PREFORK_STOPPED ? 0 : 1
  }
  return serve(worker, port)
}
