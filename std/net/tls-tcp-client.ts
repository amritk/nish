/**
 * `nish/net/tls-tcp-client` — a TLS 1.3 client over one TCP connection on
 * `nish:net`, blocking with deadlines: `nish/net/tls/record-client`'s
 * `TlsRecordClient` with a socket and a readiness loop of its own under it.
 *
 *     const client = new TlsTcpClient(new TlsClient(config, random, key));
 *     const deadline: i64 = monotonicNanos() + toI64(5000000000);
 *     if (client.connect("127.0.0.1", 443, deadline) === 0 &&
 *         tlsTcpClientHandshake(client, auth, verifyChain, verifySignature, deadline) === 0) {
 *       client.write(request, 0, request.length, deadline);
 *       const n: i32 = client.read(buf, 0, buf.length, deadline);
 *     }
 *     client.close();
 *
 * **Every call waits, and every wait has a deadline.** A deadline is an
 * instant on `monotonicNanos`, not a span, so one deadline bounds a whole
 * exchange however many calls it takes. Each call waits in `pollWait` for
 * what the connection says it wants — the socket readable, writable, or both
 * — with the milliseconds left, rounded up, and reads the clock again after
 * every wake, so a signal or a wake with nothing done costs no time past the
 * deadline. When the deadline passes the call answers
 * `TLS_TCP_CLIENT_TIMEOUT`, a code no socket and no record layer answers,
 * and the connection is left as it was: the caller may call again with a
 * later deadline, or `close` it. A `connect` that times out is the
 * exception: a half-made socket is closed.
 *
 * **Authentication is the caller's.** While the handshake waits for the
 * verdict on the server's chain and CertificateVerify, `handshake` answers
 * `TLS_TCP_CLIENT_AUTHENTICATE`; the caller hands the verdict to `conn`
 * (`tlsRecordClientAuthenticate`) and calls `handshake` again.
 * `tlsTcpClientHandshake` does both with the caller's two verifiers. A
 * function is not a value and an interface holds no methods, so the
 * verifiers are passed as a generic function's arguments; this module links
 * no certificate path check and no signature verifier of its own.
 *
 * **Answers.** `handshake` answers 0 once the client's Finished is on the
 * socket; the alert the client refused the server with, 1 to 255; or a
 * negative code: `TLS_TCP_CLIENT_TIMEOUT`, the socket's failure (a negated
 * errno, kept in `error`), or `TLS_RECORD_CLIENT_RESET` when the server
 * ended the connection — its alert, if it sent one, is `conn.peerAlert`.
 * `read` and `write` answer as a socket's calls do — a count, 0 at the end
 * of the server's stream — or one of those negative codes. A server that
 * speaks only TLS 1.2 is refused in the handshake with `protocol_version`.
 *
 * **Secrets.** Everything secret is held by `conn` and its `TlsClient`, as
 * `nish/net/tls/record-client` describes, and wiped as the connection ends;
 * `close` wipes whatever is left. The read scratch holds only record bytes
 * as they came off the wire, ciphertext but for the first hellos.
 *
 * Written from RFC 8446 and docs/LANGUAGE.md's `nish:net`, not ported from
 * another implementation.
 */
import { monotonicNanos } from "nish:process"
import {
  connectResult,
  netAddress,
  netClose,
  netRead,
  netWrite,
  pollAdd,
  pollCreate,
  pollModify,
  pollWait,
  tcpConnect,
} from "nish:net"
import { TLS_MAX_RECORD } from "nish/net/tls/record"
import {
  TLS_RECORD_CLIENT_AGAIN,
  TLS_RECORD_CLIENT_AUTHENTICATE,
  TLS_RECORD_CLIENT_INVALID,
  TLS_RECORD_CLIENT_RESET,
  TLS_RECORD_CLIENT_STATE_FAILED,
  TLS_RECORD_CLIENT_STATE_HANDSHAKE,
  TLS_RECORD_CLIENT_STATE_OPEN,
  TlsRecordClient,
  tlsRecordClientAuthenticate,
} from "nish/net/tls/record-client"
import { TlsClient } from "nish/net/tls-client"

/**
 * What a call answers when its deadline passes: Linux's ETIME, "timer
 * expired" — not ETIMEDOUT (-110), which `connectResult` answers for a peer
 * that never answered.
 */
export const TLS_TCP_CLIENT_TIMEOUT: i32 = -62

/** What `handshake` answers while it waits for the caller's verdict on the server: above every alert. */
export const TLS_TCP_CLIENT_AUTHENTICATE: i32 = 256

/** What a call answers before `connect` has made the connection, or after `close`: Linux's ENOTCONN. */
export const TLS_TCP_CLIENT_NOT_CONNECTED: i32 = -107

/** The address form's length, from `nish:net`. */
const TLS_TCP_CLIENT_ADDRESS_SIZE: i32 = 18

/** A typed zero for the offsets below: a bare literal is an `f64` under `--number-mode f64`. */
const TLS_TCP_CLIENT_FROM: i32 = 0

/** The token the socket is watched under; it is the loop's only descriptor. */
const TLS_TCP_CLIENT_TOKEN: i32 = 1

/** `pollWait`'s event bits: readable, writable, and a hang-up or error. */
const TLS_TCP_CLIENT_READABLE: i32 = 1
const TLS_TCP_CLIENT_WRITABLE: i32 = 2
const TLS_TCP_CLIENT_HANGUP: i32 = 4

/** The longest single wait, in milliseconds: what fits `pollWait`'s `i32`. */
const TLS_TCP_CLIENT_LONGEST_WAIT: i32 = 2147483647

/**
 * The milliseconds left before `deadline`, rounded up so a wait never ends
 * before it, and at most `TLS_TCP_CLIENT_LONGEST_WAIT`; -1 once it has
 * passed.
 */
const tlsTcpClientRemaining = (deadline: i64): i32 => {
  const left: i64 = deadline - monotonicNanos()
  if (left <= toI64(0)) {
    return -1
  }
  const ms: i64 = (left + toI64(999999)) / toI64(1000000)
  return ms > toI64(TLS_TCP_CLIENT_LONGEST_WAIT) ? TLS_TCP_CLIENT_LONGEST_WAIT : toI32(ms)
}

/**
 * One TLS 1.3 client connection over TCP. Make it around a fresh
 * `TlsClient`, `connect`, `handshake`, then `read` and `write`, and `close`
 * it once done, whatever happened.
 *
 * The fields are readable: `conn` (the record layer: its state, `alert`,
 * `peerAlert`, and through `conn.tls` the suite, ALPN and the server's
 * chain), `fd` (the socket, -1 before `connect` and after `close`), and
 * `error` (the socket failure that ended the connection, a negated errno, or
 * 0).
 */
export class TlsTcpClient {
  conn: TlsRecordClient
  /** `pollWait`'s answer: one token and its events. */
  ready: i32[]
  /** Where the socket is read into before `conn` takes the bytes: the largest record. */
  scratch: u8[]
  fd: i32 = -1
  loop: i32 = -1
  error: i32 = 0
  /** The ClientHello is written: `conn.start` has run. */
  started: boolean = false

  constructor(tls: TlsClient) {
    this.conn = new TlsRecordClient(tls)
    this.ready = new Array<i32>(2)
    this.scratch = new Array<u8>(TLS_MAX_RECORD)
  }

  /**
   * Connects to `host`, a numeric IPv4 or IPv6 address (`nish:net` has no
   * DNS; the name the certificate is checked against is the `TlsClient`'s
   * `serverName`), on `port`, by `deadline`. Answers 0; `-22` for a host that
   * is not numeric, or a second `connect`; the connection's failure, such as
   * `-111` when nobody listens; or `TLS_TCP_CLIENT_TIMEOUT`. On any answer but
   * 0 no socket is left open.
   */
  connect(host: string, port: i32, deadline: i64): i32 {
    if (this.fd >= 0 || this.started) {
      return TLS_RECORD_CLIENT_INVALID
    }
    const address: u8[] = new Array<u8>(TLS_TCP_CLIENT_ADDRESS_SIZE)
    const parsed: i32 = netAddress(address, host, port)
    if (parsed < 0) {
      return parsed
    }
    const fd: i32 = tcpConnect(address)
    if (fd < 0) {
      return fd
    }
    const loop: i32 = pollCreate()
    if (loop < 0) {
      netClose(fd)
      return loop
    }
    this.fd = fd
    this.loop = loop
    const added: i32 = pollAdd(loop, fd, TLS_TCP_CLIENT_WRITABLE, TLS_TCP_CLIENT_TOKEN)
    let result: i32 = added < 0 ? added : this.wait(TLS_TCP_CLIENT_WRITABLE, deadline)
    if (result >= 0) {
      result = connectResult(fd)
    }
    if (result !== 0) {
      this.release()
    }
    return result
  }

  /**
   * Runs the handshake as far as `deadline`: answers 0 once it is done and
   * the client's Finished is on the socket, `TLS_TCP_CLIENT_AUTHENTICATE`
   * when the caller's verdict on the server is wanted, or the failure as the
   * module's doc comment lists them. Called again once open, it answers 0.
   */
  handshake(deadline: i64): i32 {
    if (this.fd < 0) {
      return TLS_TCP_CLIENT_NOT_CONNECTED
    }
    const conn: TlsRecordClient = this.conn
    if (!this.started) {
      this.started = true
      conn.start()
    }
    while (true) {
      this.flush()
      if (conn.state === TLS_RECORD_CLIENT_STATE_FAILED) {
        return this.failure()
      }
      const interest: i32 = conn.interest()
      const sending: boolean = conn.outputEnd > conn.outputStart
      if (conn.state !== TLS_RECORD_CLIENT_STATE_HANDSHAKE && !sending) {
        return conn.state === TLS_RECORD_CLIENT_STATE_OPEN ? 0 : TLS_RECORD_CLIENT_RESET
      }
      if ((interest & TLS_RECORD_CLIENT_AUTHENTICATE) !== 0) {
        return TLS_TCP_CLIENT_AUTHENTICATE
      }
      const woke: i32 = this.waitFor(interest, deadline)
      if (woke < 0) {
        return woke
      }
    }
  }

  /**
   * Application data from the server into `buf[off .. off + len)`, waiting
   * until some arrives or `deadline` passes: the count; 0 at the end of the
   * server's stream (its `close_notify`) or for a `len` of 0; or a negative
   * code. `TLS_RECORD_CLIENT_AGAIN` before the handshake is done.
   */
  read(buf: u8[], off: i32, len: i32, deadline: i64): i32 {
    if (this.fd < 0) {
      return TLS_TCP_CLIENT_NOT_CONNECTED
    }
    const conn: TlsRecordClient = this.conn
    if (conn.state === TLS_RECORD_CLIENT_STATE_HANDSHAKE) {
      return TLS_RECORD_CLIENT_AGAIN
    }
    while (true) {
      const got: i32 = conn.read(buf, off, len)
      // A read can owe the server a KeyUpdate it asked for.
      this.flush()
      if (got !== TLS_RECORD_CLIENT_AGAIN) {
        return got === TLS_RECORD_CLIENT_RESET ? this.failure() : got
      }
      const woke: i32 = this.waitFor(conn.interest(), deadline)
      if (woke < 0) {
        return woke
      }
    }
  }

  /**
   * Application data for the server, `data[off .. off + len)`: seals all of
   * it and sends it, waiting while the socket takes no more, until
   * `deadline`. Answers `len`, or, when the deadline passes or the
   * connection fails part way, how much was sealed — sent, or left in `conn`
   * for the next call to send — or a negative code when none was.
   * `TLS_RECORD_CLIENT_AGAIN` before the handshake is done.
   */
  write(data: u8[], off: i32, len: i32, deadline: i64): i32 {
    if (this.fd < 0) {
      return TLS_TCP_CLIENT_NOT_CONNECTED
    }
    const conn: TlsRecordClient = this.conn
    if (conn.state === TLS_RECORD_CLIENT_STATE_HANDSHAKE) {
      return TLS_RECORD_CLIENT_AGAIN
    }
    let done: i32 = 0
    while (true) {
      if (done < len) {
        const sealed: i32 = conn.write(data, off + done, len - done)
        if (sealed > 0) {
          done = done + sealed
        } else if (sealed !== TLS_RECORD_CLIENT_AGAIN) {
          return done > 0 ? done : sealed === TLS_RECORD_CLIENT_RESET ? this.failure() : sealed
        }
      }
      this.flush()
      if (done === len && conn.outputEnd === conn.outputStart) {
        return done
      }
      if (conn.state === TLS_RECORD_CLIENT_STATE_FAILED) {
        return done > 0 ? done : this.failure()
      }
      const woke: i32 = this.waitFor(conn.interest(), deadline)
      if (woke < 0) {
        return done > 0 ? done : woke
      }
    }
  }

  /**
   * Ends the connection: a `close_notify` sent if the socket takes it at
   * once (a failed connection's last alert likewise), the socket and the
   * loop closed, and every key and buffer the connection holds wiped. Safe to
   * call at any point, more than once.
   */
  close(): void {
    if (this.fd >= 0) {
      this.conn.close()
      this.flush()
    }
    this.release()
    this.conn.wipe()
  }

  /** Closes the socket and the loop, if open. */
  release(): void {
    if (this.fd >= 0) {
      netClose(this.fd)
      this.fd = -1
    }
    if (this.loop >= 0) {
      netClose(this.loop)
      this.loop = -1
    }
  }

  /**
   * What a failed connection answers: the alert the client sent, the
   * socket's failure, or `TLS_RECORD_CLIENT_RESET` when the server ended it.
   */
  failure(): i32 {
    if (this.conn.alert !== 0) {
      return this.conn.alert
    }
    return this.error !== 0 ? this.error : TLS_RECORD_CLIENT_RESET
  }

  /**
   * Waits for what `interest` (the connection's) asks of the socket, and
   * reads it when it is readable or hung up. Answers 0, or a negative code:
   * the wait timed out or failed, or the connection wants nothing of the
   * socket, which only a connection that cannot move answers.
   */
  waitFor(interest: i32, deadline: i64): i32 {
    const events: i32 = interest & (TLS_TCP_CLIENT_READABLE | TLS_TCP_CLIENT_WRITABLE)
    if (events === 0) {
      return this.conn.state === TLS_RECORD_CLIENT_STATE_FAILED ? this.failure() : TLS_RECORD_CLIENT_RESET
    }
    const woke: i32 = this.wait(events, deadline)
    if (woke < 0) {
      return woke
    }
    if ((woke & (TLS_TCP_CLIENT_READABLE | TLS_TCP_CLIENT_HANGUP)) !== 0) {
      this.readable()
    }
    return 0
  }

  /**
   * Waits in `pollWait` for `events` on the socket until `deadline`: the
   * events that came back, `TLS_TCP_CLIENT_TIMEOUT`, or the loop's failure.
   * A wake with nothing ready — a signal — waits again for what is left.
   */
  wait(events: i32, deadline: i64): i32 {
    const armed: i32 = pollModify(this.loop, this.fd, events, TLS_TCP_CLIENT_TOKEN)
    if (armed < 0) {
      return armed
    }
    while (true) {
      const ms: i32 = tlsTcpClientRemaining(deadline)
      if (ms < 0) {
        return TLS_TCP_CLIENT_TIMEOUT
      }
      const n: i32 = pollWait(this.loop, this.ready, ms)
      if (n < 0) {
        return n
      }
      if (n > 0) {
        return this.ready[1]
      }
    }
  }

  /**
   * Reads the socket until it would block or the connection has no room,
   * handing each read to the connection. The end of the stream goes to
   * `conn.end`, and a failure to `conn.abort` with the errno kept in `error`.
   */
  readable(): void {
    const conn: TlsRecordClient = this.conn
    while (true) {
      const room: i32 = conn.space()
      const want: i32 = room < toI32(this.scratch.length) ? room : toI32(this.scratch.length)
      if (want <= 0 || conn.state === TLS_RECORD_CLIENT_STATE_FAILED || conn.peerClosed) {
        return
      }
      const n: i32 = netRead(this.fd, this.scratch, TLS_TCP_CLIENT_FROM, want)
      if (n <= 0) {
        if (n === 0) {
          conn.end()
        } else if (n !== TLS_RECORD_CLIENT_AGAIN) {
          this.error = n
          conn.abort()
        }
        return
      }
      conn.receive(this.scratch, TLS_TCP_CLIENT_FROM, n)
    }
  }

  /**
   * Writes what the connection has to send until the socket would block or
   * it is all sent. A failure goes to `conn.abort`, the errno kept in
   * `error`.
   */
  flush(): void {
    const conn: TlsRecordClient = this.conn
    while (this.fd >= 0 && conn.outputEnd > conn.outputStart) {
      const n: i32 = netWrite(this.fd, conn.output, conn.outputStart, conn.outputEnd - conn.outputStart)
      if (n <= 0) {
        if (n !== TLS_RECORD_CLIENT_AGAIN) {
          this.error = n
          conn.abort()
        }
        return
      }
      conn.consume(n)
    }
  }
}

/**
 * Runs `client`'s handshake to its end by `deadline`, asking the caller's
 * verifiers when the verdict on the server is wanted, as
 * `tlsRecordClientAuthenticate` does: `verifyChain(auth, chain, serverName)`
 * answers 0 or the alert to refuse the chain with, and only a chain it
 * accepts is asked `verifySignature(auth, chain, scheme, content,
 * signature)`. Answers what `handshake` answers, but never
 * `TLS_TCP_CLIENT_AUTHENTICATE`.
 */
export const tlsTcpClientHandshake = <A>(
  client: TlsTcpClient,
  auth: A,
  verifyChain: (auth: A, chain: u8[][], serverName: string) => i32,
  verifySignature: (auth: A, chain: u8[][], scheme: i32, content: u8[], signature: u8[]) => boolean,
  deadline: i64
): i32 => {
  let answer: i32 = client.handshake(deadline)
  if (answer === TLS_TCP_CLIENT_AUTHENTICATE) {
    tlsRecordClientAuthenticate(client.conn, auth, verifyChain, verifySignature)
    answer = client.handshake(deadline)
  }
  return answer
}
