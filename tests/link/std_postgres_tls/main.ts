// `PgCarrier` over TLS, on loopback: an `HttpHandler`, the carrier and a
// stand-in PostgreSQL server, all on one thread. The stand-in reads the
// eight-byte SSLRequest and keeps it, answers `N` or `S`, and after `S` runs
// a TLS 1.3 server (`TlsRecordServer`, the P-256 leaf of `net_tls_common`)
// with the chain each case gives it, then speaks the protocol's extended
// query flow with no authentication inside it. Every Execute answers one row,
// `ok`. The certificates are `net_http_fetch_tls`'s.
//
//   1. Refusal: the SSLRequest's bytes are pinned, and an `N` fails the query
//      with PG_ERR_TLS and no alert, before any StartupMessage is sent.
//   2. verify-full: a chain the roots trust, for the target's address,
//      answers the query; the StartupMessage went inside TLS; `close()`
//      ends the connection with a close_notify.
//   3. verify-full refusals: a chain from a root the file does not hold,
//      and a leaf for another name, fail the query with PG_ERR_TLS and the
//      alert the client sent, and the server never sees a StartupMessage.
//   4. The name: `tlsServerName` is the name checked, not the target's
//      address, both ways.
//   5. require: a chain no root vouches for is taken, as libpq's
//      `sslmode=require` takes it.
import { copyBytes } from "nish/bytes"
import { HandlerLimits, HttpHandler } from "nish/net/handler"
import { PG_ERR_TLS, PG_TLS_REQUIRE, PG_TLS_VERIFY_FULL, PgConfig, PgPool, pgTarget } from "nish/net/postgres"
import {
  PG_CARRIER_BUILD,
  PG_CARRIER_DONE,
  PG_CARRIER_FAILED,
  PG_CARRIER_MISSING,
  PG_CARRIER_NONE,
  PG_CARRIER_ROW,
  PgCarrier,
  PgCarrierLimits,
} from "nish/net/postgres-carrier"
import { Router, RouterLimits } from "nish/net/router"
import { TlsServer, TlsServerConfig, tlsSignEcdsaP256 } from "nish/net/tls"
import { TLS_SIGNATURE_ECDSA_SECP256R1_SHA256 } from "nish/net/tls/codec"
import { TLS_RECORD_DONE, TLS_RECORD_SIGN, TlsRecordServer } from "nish/net/tls/record-server"
import { realpathSync, writeFileSync } from "nish:fs"
import { netClose, netLocalPort, netRead, netWrite, tcpAccept, tcpListen } from "nish:net"
import { monotonicNanos, platform } from "nish:process"
import { Secret, secret, wipe } from "nish:secret"
import { leafPrivate, serverPrivate, serverRandom } from "../net_tls_common/server"
import { goodLeaf, strangerLeaf, strangerRoot, trustedRootPem, wrongHostLeaf } from "../net_http_fetch_tls/certs"

const ZERO: i32 = 0
const AGAIN: i32 = -11
const FIVE_SECONDS: i64 = 5000000000
const ANSWER_YES: i32 = 83
const ANSWER_NO: i32 = 78

const ascii = (text: string): u8[] => {
  const out: u8[] = new Array<u8>(text.length)
  for (let k: i32 = 0; k < toI32(text.length) && k < toI32(out.length); k++) {
    out[k] = toU8(text.charCodeAt(k))
  }
  return out
}

const be32 = (buf: u8[], at: i32): i32 =>
  (toI32(buf[at]) << 24) | (toI32(buf[at + 1]) << 16) | (toI32(buf[at + 2]) << 8) | toI32(buf[at + 3])

/** The test binary's own path, for the roots file beside it. */
const selfPath = (): string => {
  const exe: string | null = platform === "linux" ? realpathSync("/proc/self/exe") : null
  return exe !== null ? exe : process.argv[0]
}

/** A server configuration sending `chain`, offering `postgresql` as libpq 17 asks for it. */
const configFor = (chain: u8[][]): TlsServerConfig => {
  const none: u8[] = []
  const alpn: string[] = ["postgresql"]
  return {
    certificateChain: chain,
    alpn: alpn,
    quicTransportParameters: none,
    extraExtensions: none,
    signatureScheme: TLS_SIGNATURE_ECDSA_SECP256R1_SHA256,
    quic: false,
  }
}

/** The stand-in: one connection at a time, its SSLRequest, its TLS and its plaintext. */
class Stand {
  peer: u8[]
  /** The chain it sends after `S`. */
  chain: u8[][]
  /** The SSLRequest's bytes as read. */
  asked: u8[]
  tls: TlsRecordServer | null = null
  wire: u8[]
  input: u8[]
  output: u8[]
  listener: i32
  port: i32
  /** What it answers the SSLRequest with. */
  answer: i32 = 83
  fd: i32 = -1
  askedLen: i32 = 0
  inLen: i32 = 0
  outStart: i32 = 0
  outLen: i32 = 0
  lenAt: i32 = 0
  /** How many StartupMessages arrived inside TLS, and how many Executes it answered. */
  startups: i32 = 0
  executed: i32 = 0
  /** How many bytes arrived after an `N`: a client that wanted TLS sends none. */
  afterNo: i32 = 0
  started: boolean = false
  /** Whether the client sent close_notify. */
  notified: boolean = false

  constructor() {
    this.listener = tcpListen("127.0.0.1", 0, 4)
    this.port = netLocalPort(this.listener)
    this.peer = new Array<u8>(32)
    this.chain = [goodLeaf()]
    this.asked = new Array<u8>(8)
    this.wire = new Array<u8>(17000)
    this.input = new Array<u8>(65536)
    this.output = new Array<u8>(65536)
  }

  /** Forgets the last connection's counts, for the next case. */
  reset(answer: i32, chain: u8[][]): void {
    this.answer = answer
    this.chain = chain
    this.askedLen = 0
    this.startups = 0
    this.executed = 0
    this.notified = false
    this.afterNo = 0
  }

  close(): void {
    if (this.fd >= 0) {
      netClose(this.fd)
    }
    this.fd = -1
    const tls: TlsRecordServer | null = this.tls
    if (tls !== null) {
      tls.wipe()
    }
    this.tls = null
  }

  serve(): void {
    if (this.fd < 0) {
      const fd: i32 = tcpAccept(this.listener, this.peer)
      if (fd < 0) {
        return
      }
      this.fd = fd
      this.inLen = 0
      this.outStart = 0
      this.outLen = 0
      this.started = false
    }
    if (this.askedLen < 8) {
      const got: i32 = netRead(this.fd, this.asked, this.askedLen, 8 - this.askedLen)
      if (got === 0 || (got < 0 && got !== AGAIN)) {
        this.close()
        return
      }
      if (got > 0) {
        this.askedLen += got
      }
      if (this.askedLen < 8) {
        return
      }
      const one: u8[] = [toU8(this.answer)]
      netWrite(this.fd, one, ZERO, toI32(1))
      if (this.answer === ANSWER_YES) {
        this.tls = new TlsRecordServer(new TlsServer(configFor(this.chain), serverRandom(), serverPrivate()))
      }
    }
    const tls: TlsRecordServer | null = this.tls
    if (tls === null) {
      const got: i32 = netRead(this.fd, this.input, ZERO, toI32(this.input.length))
      if (got > 0) {
        this.afterNo += got
      } else if (got !== AGAIN) {
        this.close()
      }
      return
    }
    this.pump(tls)
  }

  pump(tls: TlsRecordServer): void {
    const room: i32 = tls.space()
    const got: i32 = netRead(this.fd, this.wire, ZERO, room < toI32(this.wire.length) ? room : toI32(this.wire.length))
    if (got > 0) {
      tls.receive(this.wire, ZERO, got)
    } else if (got === 0) {
      tls.end()
    } else if (got !== AGAIN) {
      tls.abort()
    }
    if ((tls.interest() & TLS_RECORD_SIGN) !== 0) {
      const input: u8[] | null = tls.signatureInput()
      const none: u8[] = []
      const key: Secret<u8[]> = secret(leafPrivate())
      const signature: u8[] | null = input === null ? null : tlsSignEcdsaP256(key, input)
      wipe(key)
      tls.sign(signature === null ? none : signature)
    }
    let n: i32 = tls.read(this.input, this.inLen, toI32(this.input.length) - this.inLen)
    while (n > 0) {
      this.inLen += n
      n = tls.read(this.input, this.inLen, toI32(this.input.length) - this.inLen)
    }
    if (n === 0 && this.inLen < toI32(this.input.length)) {
      this.notified = true
    }
    this.process()
    if (this.outLen > this.outStart) {
      const sealed: i32 = tls.write(this.output, this.outStart, this.outLen - this.outStart)
      if (sealed > 0) {
        this.outStart += sealed
        if (this.outStart === this.outLen) {
          this.outStart = 0
          this.outLen = 0
        }
      }
    }
    while (tls.outputEnd > tls.outputStart) {
      const sent: i32 = netWrite(this.fd, tls.output, tls.outputStart, tls.outputEnd - tls.outputStart)
      if (sent <= 0) {
        break
      }
      tls.consume(sent)
    }
    if (this.notified || (tls.interest() & TLS_RECORD_DONE) !== 0) {
      this.close()
    }
  }

  byte(b: i32): void {
    this.output[this.outLen] = toU8(b & 255)
    this.outLen += 1
  }

  int32(v: i32): void {
    this.byte(v >> 24)
    this.byte(v >> 16)
    this.byte(v >> 8)
    this.byte(v)
  }

  begin(type: i32): void {
    this.byte(type)
    this.lenAt = this.outLen
    this.int32(ZERO)
  }

  end(): void {
    const v: i32 = this.outLen - this.lenAt
    this.output[this.lenAt] = toU8((v >> 24) & 255)
    this.output[this.lenAt + 1] = toU8((v >> 16) & 255)
    this.output[this.lenAt + 2] = toU8((v >> 8) & 255)
    this.output[this.lenAt + 3] = toU8(v & 255)
  }

  text(s: string): void {
    for (let k: i32 = 0; k < toI32(s.length); k++) {
      this.byte(s.charCodeAt(k))
    }
    this.byte(0)
  }

  /** Answers every whole message the plaintext holds. */
  process(): void {
    const input: u8[] = this.input
    let at: i32 = 0
    if (!this.started) {
      if (this.inLen < 4 || this.inLen < be32(input, ZERO)) {
        return
      }
      at = be32(input, ZERO)
      this.started = true
      this.startups += 1
      this.begin(82)
      this.int32(ZERO)
      this.end()
      this.begin(83)
      this.text("client_encoding")
      this.text("UTF8")
      this.end()
      this.begin(90)
      this.byte(73)
      this.end()
    }
    while (this.inLen - at >= 5 && at >= 0 && at < toI32(input.length)) {
      const type: i32 = toI32(input[at])
      const end: i32 = at + 1 + be32(input, at + 1)
      if (end > this.inLen) {
        break
      }
      if (type === 80) {
        this.begin(49)
        this.end()
      } else if (type === 68) {
        this.begin(116)
        this.byte(0)
        this.byte(0)
        this.end()
        this.begin(110)
        this.end()
      } else if (type === 66) {
        this.begin(50)
        this.end()
      } else if (type === 69) {
        this.executed += 1
        this.begin(68)
        this.byte(0)
        this.byte(1)
        this.int32(toI32(2))
        this.byte(111)
        this.byte(107)
        this.end()
        this.begin(67)
        this.text("SELECT 1")
        this.end()
      } else if (type === 83) {
        this.begin(90)
        this.byte(73)
        this.end()
      }
      at = end
    }
    if (at > 0) {
      copyBytes(input, ZERO, input, at, this.inLen - at)
      this.inLen -= at
    }
  }
}

/** The handler the carrier rides on, the stand-in, and how many checks failed. */
class App {
  h: HttpHandler
  stand: Stand
  roots: string
  failures: i32 = 0
  /** The text of the last row a query answered. */
  row: string = ""

  constructor() {
    const router = new Router(new RouterLimits())
    router.add("GET", "/")
    this.h = new HttpHandler(new HandlerLimits(), tcpListen("127.0.0.1", 0, 4), router)
    this.stand = new Stand()
    this.roots = `${selfPath()}.roots.pem`
    writeFileSync(this.roots, trustedRootPem)
  }

  turn(): void {
    this.stand.serve()
    this.h.wait(toI32(1))
  }
}

const check = (app: App, name: string, ok: boolean): void => {
  if (ok) {
    console.log(`PASS  ${name}`)
  } else {
    console.log(`FAIL  ${name}`)
    app.failures += 1
  }
}

/** A carrier of one connection to the stand-in under `mode`, checking `name` when it is not empty. */
const carrier = (app: App, mode: i32, name: string): PgCarrier => {
  const config = new PgConfig()
  config.user = "app"
  config.database = "db"
  config.tls = mode
  config.tlsRootsPath = app.roots
  config.tlsServerName = name
  const password = secret(ascii("pw"))
  const pool = new PgPool(config, password, toI32(1), toI32(4))
  wipe(password)
  const types: i32[] = []
  pool.register("one", "select 'ok'", types)
  const limits = new PgCarrierLimits()
  limits.queries = 1
  limits.connectTimeoutMs = 5000
  return new PgCarrier(limits, pool, pgTarget("127.0.0.1", app.stand.port), app.h)
}

/** Runs one query on `c` and turns `app` until its final event, for five seconds at most. */
const query = (app: App, c: PgCarrier): i32 => {
  app.row = ""
  // The last query's slot is held until `next()` reads past its final event.
  while (c.next() !== PG_CARRIER_NONE) {}
  if (c.run(null, toI32(1)) < 0) {
    return PG_CARRIER_NONE
  }
  const deadline: i64 = monotonicNanos() + FIVE_SECONDS
  while (monotonicNanos() < deadline) {
    app.turn()
    let event: i32 = c.next()
    while (event !== PG_CARRIER_NONE) {
      if (event === PG_CARRIER_BUILD) {
        c.connection().bindStart("one")
        c.connection().bindEnd()
        c.send()
      } else if (event === PG_CARRIER_ROW) {
        const conn = c.connection()
        app.row = conn.columnText(ZERO)
      } else if (event === PG_CARRIER_DONE || event === PG_CARRIER_FAILED || event === PG_CARRIER_MISSING) {
        return event
      }
      event = c.next()
    }
  }
  return PG_CARRIER_NONE
}

/** Turns `app` until the stand-in's connection is gone, for five seconds at most. */
const settle = (app: App): void => {
  const deadline: i64 = monotonicNanos() + FIVE_SECONDS
  while (app.stand.fd >= 0 && monotonicNanos() < deadline) {
    app.turn()
  }
}

const refusal = (app: App): void => {
  app.stand.reset(ANSWER_NO, [goodLeaf()])
  const c: PgCarrier = carrier(app, PG_TLS_REQUIRE, "")
  const event: i32 = query(app, c)
  const s: Stand = app.stand
  const pinned: u8[] = [0, 0, 0, 8, 4, 210, 22, 47]
  let same: boolean = s.askedLen === 8
  for (let k: i32 = 0; k < 8; k++) {
    same = same && s.asked[k] === pinned[k]
  }
  check(app, "the SSLRequest is length 8 and code 80877103", same)
  check(app, "an N fails the query with PG_ERR_TLS and no alert", event === PG_CARRIER_FAILED && c.failure === PG_ERR_TLS && c.socketError === 0)
  c.close()
  settle(app)
  check(app, "and no StartupMessage follows it", s.afterNo === 0 && s.fd < 0)
}

const verified = (app: App): void => {
  app.stand.reset(ANSWER_YES, [goodLeaf()])
  const c: PgCarrier = carrier(app, PG_TLS_VERIFY_FULL, "")
  const event: i32 = query(app, c)
  check(app, "verify-full: a trusted chain for 127.0.0.1 answers the query", event === PG_CARRIER_DONE && app.row === "ok")
  check(app, "and the StartupMessage went inside TLS", app.stand.startups === 1 && app.stand.executed === 1)
  const again: i32 = query(app, c)
  check(app, "the next query reuses the TLS connection", again === PG_CARRIER_DONE && app.row === "ok" && app.stand.executed === 2)
  c.close()
  settle(app)
  check(app, "close() ends it with a close_notify", app.stand.notified && app.stand.fd < 0)
}

/** A verify-full query against `chain` under `name`, which the client refuses. */
const refused = (app: App, label: string, chain: u8[][], name: string): void => {
  app.stand.reset(ANSWER_YES, chain)
  const c: PgCarrier = carrier(app, PG_TLS_VERIFY_FULL, name)
  const event: i32 = query(app, c)
  check(app, `verify-full refuses ${label} with PG_ERR_TLS and an alert`, event === PG_CARRIER_FAILED && c.failure === PG_ERR_TLS && c.socketError > 0)
  c.close()
  settle(app)
  check(app, "and the server never sees a StartupMessage", app.stand.startups === 0 && app.stand.executed === 0)
}

const named = (app: App): void => {
  app.stand.reset(ANSWER_YES, [goodLeaf()])
  const c: PgCarrier = carrier(app, PG_TLS_VERIFY_FULL, "localhost")
  check(app, "tlsServerName localhost is checked in place of the address", query(app, c) === PG_CARRIER_DONE && app.row === "ok")
  c.close()
  settle(app)
  refused(app, "a good leaf under another tlsServerName", [goodLeaf()], "db.example")
}

const required = (app: App): void => {
  app.stand.reset(ANSWER_YES, [strangerLeaf(), strangerRoot()])
  const c: PgCarrier = carrier(app, PG_TLS_REQUIRE, "")
  check(app, "require takes a chain no root vouches for", query(app, c) === PG_CARRIER_DONE && app.row === "ok")
  c.close()
  settle(app)
}

export const main = (): i32 => {
  const app = new App()
  refusal(app)
  verified(app)
  refused(app, "a chain from a root the file does not hold", [strangerLeaf(), strangerRoot()], "")
  refused(app, "a leaf for another name", [wrongHostLeaf()], "")
  named(app)
  required(app)
  return app.failures === 0 ? 0 : 1
}
