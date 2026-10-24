// A carrier for nish/net/postgres's PgPool: one epoll loop holding the pool's
// sockets and an HTTP listener. It runs `select pg_sleep(...)` through the pool
// and serves HTTP while the query is in flight, then prints the query's row.
//
//   carrier <pg port> <user> <password> <database> <http port> <seconds>
//
// It prints `listening` once its HTTP port is open and `query sent` once the
// query is handed to a connection. `tests/postgres/live/run.mjs` runs it
// against a live server and requests `/` after the second; the answer says
// whether the query was in flight. A socket error on a pool connection, not
// only an orderly close, ends the connection: run.mjs's `reset` check.
import { connectResult, netAddress, netClose, netRead, netWrite, pollAdd, pollCreate, pollModify, pollRemove, pollWait, tcpConnect, tcpListen } from "nish:net"
import { secret, wipe } from "nish:secret"
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
import { PG_FAILED, PG_GROUP_DONE, PG_LOST, PG_NEED_MORE, PG_POOL_NONE, PG_ROW, PgConfig, PgConnection, PgPool } from "nish/net/postgres"

/** The HTTP listener's token; an HTTP connection's token is its slot, from 0. */
const LISTENER: i32 = -1
/** A pool slot `s` is watched under `POOL_TOKEN - s`, below every HTTP token. */
const POOL_TOKEN: i32 = -2
/** `netRead` and `netWrite`: nothing to do now. */
const AGAIN: i32 = -11

/** A pool slot's socket: -1 for none, whether its connect has finished, and whether its connection has events to read. */
class Socket {
  fd: i32 = -1
  connected: boolean = false
  pending: boolean = false
}

const bytesOf = (s: string): u8[] => {
  const out: u8[] = new Array<u8>(s.length)
  for (let k: i32 = 0; k < toI32(s.length) && k < toI32(out.length); k++) {
    out[k] = toU8(s.charCodeAt(k))
  }
  return out
}

/** Writes what `conn` queued; false when the socket is gone. */
const flush = (conn: PgConnection, fd: i32): boolean => {
  while (conn.outputEnd() > conn.outputStart()) {
    const n: i32 = netWrite(fd, conn.outputBuffer(), conn.outputStart(), conn.outputEnd() - conn.outputStart())
    if (n === AGAIN) {
      return true
    }
    if (n <= 0) {
      return false
    }
    conn.sent(n)
  }
  return true
}

export const main = (): i32 => {
  if (process.argv.length < 7) {
    console.log("usage: carrier <pg port> <user> <password> <database> <http port> <seconds>")
    return 2
  }
  const config = new PgConfig()
  config.user = process.argv[2]
  config.database = process.argv[4]
  const sockets: Socket[] = [new Socket(), new Socket()]
  const password = secret(bytesOf(process.argv[3]))
  const pool = new PgPool(config, password, toI32(sockets.length), toI32(16))
  wipe(password)
  pool.register("nap", "select 'slept ' || $1 from pg_sleep($1::float8)", [toI32(25)])

  const pgAddr = new Array<u8>(18)
  netAddress(pgAddr, "127.0.0.1", parseInt(process.argv[1]))
  const listener: i32 = tcpListen("127.0.0.1", parseInt(process.argv[5]), toI32(16))
  if (listener < 0) {
    console.log(`listen failed: ${listener}`)
    return 1
  }
  console.log("listening")
  const server = new Http1Server(new Http1Config(), listener, toI32(16))
  const loop: i32 = pollCreate()
  const ready: i32[] = new Array<i32>(64)
  const names: u8[][] = [bytesOf("Content-Type")]
  const values: u8[][] = [bytesOf("text/plain")]
  pollAdd(loop, listener, H1_WANT_READ, LISTENER)

  const nap: i32 = pool.request()
  let napDone: boolean = false
  let served: i32 = 0
  let code: i32 = 0

  while ((!napDone || served === 0) && code === 0) {
    // Read the events of the connections that read bytes, or failed.
    for (let s: i32 = 0; s < toI32(sockets.length) && code === 0; s++) {
      const socket = sockets[s]
      if (socket.pending) {
        socket.pending = false
        const conn = pool.connection(s)
        let event: i32 = pool.next(s)
        while (event !== PG_NEED_MORE) {
          if (event === PG_ROW && pool.ticket === nap) {
            console.log(conn.columnText(toI32(0)))
          } else if (event === PG_GROUP_DONE && pool.ticket === nap) {
            napDone = true
            code = conn.groupFailed ? 1 : 0
          } else if (event === PG_LOST) {
            console.log(`request ${pool.ticket} lost`)
          } else if (event === PG_FAILED) {
            console.log(`slot ${s} failed: ${conn.failure}`)
            if (socket.fd >= 0) {
              pollRemove(loop, socket.fd)
              netClose(socket.fd)
              socket.fd = -1
            }
            napDone = true
            code = 1
            break
          }
          event = pool.next(s)
        }
      }
    }
    if ((napDone && served > 0) || code !== 0) {
      break
    }
    // Hand waiting requests to ready connections, and make the ones wanted.
    let slot: i32 = pool.dispatch()
    while (slot >= 0) {
      const conn = pool.connection(slot)
      conn.bindStart("nap")
      conn.paramText(process.argv[6])
      conn.bindEnd()
      pool.send()
      console.log("query sent")
      slot = pool.dispatch()
    }
    slot = pool.wanted()
    while (slot >= 0 && slot < toI32(sockets.length)) {
      const socket = sockets[slot]
      const nonce = new Array<u8>(18)
      crypto.getRandomValues(nonce)
      pool.connect(slot, nonce)
      socket.fd = tcpConnect(pgAddr)
      socket.connected = false
      if (socket.fd < 0 || pollAdd(loop, socket.fd, H1_WANT_WRITE, POOL_TOKEN - slot) < 0) {
        pool.connection(slot).closed()
        socket.pending = true
      }
      slot = pool.wanted()
    }
    // A connect that failed has its loss to report before the loop waits.
    let failed: boolean = false
    for (let s: i32 = 0; s < toI32(sockets.length); s++) {
      failed = failed || sockets[s].pending
    }
    if (failed) {
      continue
    }
    // Send what the connections queued, and ask for writability only while some stays.
    for (let s: i32 = 0; s < toI32(sockets.length); s++) {
      const socket = sockets[s]
      if (socket.fd >= 0 && socket.connected) {
        const conn = pool.connection(s)
        if (!flush(conn, socket.fd)) {
          conn.closed()
          socket.pending = true
        }
        const wants: i32 = conn.outputEnd() > conn.outputStart() ? H1_WANT_READ | H1_WANT_WRITE : H1_WANT_READ
        pollModify(loop, socket.fd, wants, POOL_TOKEN - s)
      }
    }

    const n: i32 = pollWait(loop, ready, toI32(10000))
    if (n <= 0) {
      console.log("timed out")
      return 1
    }
    for (let k: i32 = 0; k < n; k++) {
      const token: i32 = ready[2 * k]
      const s: i32 = POOL_TOKEN - token
      if (token === LISTENER) {
        let next: i32 = server.accept()
        while (next >= 0 || next === H1_POOL_FULL) {
          if (next >= 0) {
            pollAdd(loop, server.fd(next), H1_WANT_READ, next)
          }
          next = server.accept()
        }
      } else if (token >= 0 && server.holds(token)) {
        let wants: i32 = (ready[2 * k + 1] & 5) !== 0 ? server.readable(token) : server.writable(token)
        let event: i32 = server.next(token)
        while (event !== H1_NEED_MORE && event !== H1_ERROR) {
          if (event === H1_END) {
            const body: u8[] = bytesOf(napDone ? "query done\n" : "query in flight\n")
            console.log(napDone ? "http served after the query" : "http served while the query is in flight")
            const conn = server.connection(token)
            conn.respond(toI32(200), names, values, toI32(body.length))
            conn.write(body, toI32(0), toI32(body.length))
            conn.end()
            served += 1
          }
          event = server.next(token)
        }
        wants = server.flush(token)
        if ((wants & H1_DONE) !== 0) {
          server.close(token)
        } else if (server.rearm(token, wants)) {
          pollModify(loop, server.fd(token), wants & (H1_WANT_READ | H1_WANT_WRITE), token)
        }
      } else if (s >= 0 && s < toI32(sockets.length)) {
        const socket = sockets[s]
        const conn = pool.connection(s)
        if (!socket.connected) {
          // The socket is writable once its connect finished, or failed.
          if (connectResult(socket.fd) === 0) {
            socket.connected = true
          } else {
            conn.closed()
          }
        } else if ((ready[2 * k + 1] & 5) !== 0) {
          const got: i32 = netRead(socket.fd, conn.inputBuffer(), conn.inputEnd(), conn.inputRoom())
          if (got < 0 && got !== AGAIN) {
            // The failure is printed after closed(), so the log pins the close
            // on this turn, not a later read of 0.
            conn.closed()
            console.log(`slot ${s} read failed: ${got}, failure ${conn.failure}`)
          } else if (got === 0) {
            conn.closed()
          } else if (got > 0) {
            conn.received(got)
          }
        }
        socket.pending = true
      }
    }
  }

  for (let s: i32 = 0; s < toI32(sockets.length); s++) {
    const socket = sockets[s]
    if (socket.fd >= 0) {
      const conn = pool.connection(s)
      conn.terminate()
      flush(conn, socket.fd)
      netClose(socket.fd)
    }
  }
  pool.dispose()
  return code
}
