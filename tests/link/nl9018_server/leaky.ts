// A request loop on Http1Server whose handler builds its reply text on every
// request. Each reply is a new string, and nothing in the loop gives them
// back, so the process grows for as long as it serves: NL9018 names the loop.
// `flat.ts` is the same server with the arena block.
import { netLocalPort, pollAdd, pollCreate, pollModify, pollWait, tcpListen } from "nish:net"
import {
  H1_DONE,
  H1_END,
  H1_ERROR,
  H1_NEED_MORE,
  H1_POOL_FULL,
  H1_WANT_READ,
  H1_WANT_WRITE,
  Http1Config,
  Http1Connection,
  Http1Server,
} from "nish/net/http1-server"

const LISTENER: i32 = -1

/** The headers every reply carries, built once. */
class Heads {
  names: u8[][]
  values: u8[][]
  /** The reply body, written over for every request, and how much of it is used. */
  reply: u8[]
  served: i32
  used: i32

  constructor() {
    this.names = [bytesOf("Content-Type")]
    this.values = [bytesOf("text/plain")]
    this.served = 0
    this.reply = new Array<u8>(64)
    this.used = 0
  }
}

const bytesOf = (s: string): u8[] => {
  const out: u8[] = new Array<u8>(s.length)
  for (let k: i32 = 0; k < toI32(s.length) && k < toI32(out.length); k++) {
    out[k] = toU8(s.charCodeAt(k))
  }
  return out
}

/** Copies `s` into the reply buffer, as much of it as fits. */
const fill = (heads: Heads, s: string): void => {
  let k: i32 = 0
  while (k < toI32(s.length) && k < toI32(heads.reply.length)) {
    heads.reply[k] = toU8(s.charCodeAt(k))
    k++
  }
  heads.used = k
}

/** Answers one request with the reply buffer. */
const answer = (conn: Http1Connection, heads: Heads): void => {
  if (conn.respond(200, heads.names, heads.values, heads.used) < 0) {
    conn.abort()
    return
  }
  conn.write(heads.reply, 0, heads.used)
  conn.end()
}

/** Serves until `limit` requests are answered (forever when it is negative). */
const serve = (listener: i32, limit: i32): i32 => {
  const server = new Http1Server(new Http1Config(), listener, 16)
  const heads = new Heads()
  const loop: i32 = pollCreate()
  const ready: i32[] = new Array<i32>(64)
  pollAdd(loop, listener, H1_WANT_READ, LISTENER)
  while (limit < 0 || heads.served !== limit) {
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
        if ((ready[2 * k + 1] & 5) !== 0) {
          server.readable(slot)
        } else {
          server.writable(slot)
        }
        let event: i32 = server.next(slot)
        while (event !== H1_NEED_MORE && event !== H1_ERROR) {
          if (event === H1_END) {
            fill(heads, `request ${heads.served}\n`)
            answer(server.connection(slot), heads)
            heads.served = heads.served + 1
          }
          event = server.next(slot)
        }
        const wants: i32 = server.flush(slot)
        if ((wants & H1_DONE) !== 0) {
          server.close(slot)
        } else if (server.rearm(slot, wants)) {
          pollModify(loop, server.fd(slot), wants & (H1_WANT_READ | H1_WANT_WRITE), slot)
        }
      }
    }
  }
  return 0
}

export const main = (): i32 => {
  const args: string[] = process.argv
  const limit: i32 = args.length > 1 ? toI32(parseInt(args[1])) : -1
  const listener: i32 = tcpListen("127.0.0.1", 0, 128)
  if (listener < 0) {
    return 1
  }
  console.log(`${netLocalPort(listener)}`)
  return serve(listener, limit)
}
