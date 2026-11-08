/**
 * `nish/net/dns` — the stub resolver of `nish/net/dns-resolver` driven over
 * `nish:net` sockets on the caller's own readiness loop, and `resolveHost`,
 * which runs a loop of its own for a program that has none.
 *
 *     import { DnsClient, resolveHost } from "nish/net/dns"
 *     import { DNS_RESOLVE_MAX_ADDRESSES, DNS_RESOLVE_PENDING, DnsResolver } from "nish/net/dns-resolver"
 *     import { DnsConfig, dnsParseResolvConf } from "nish/net/dns-config"
 *     import { DNS_ADDRESS_BYTES } from "nish/net/dns-message"
 *     import { readFileBytesSync } from "nish:fs"
 *     import { pollCreate, pollWait } from "nish:net"
 *     import { monotonicNanos } from "nish:process"
 *
 *     const out: u8[] = new Array<u8>(DNS_RESOLVE_MAX_ADDRESSES * DNS_ADDRESS_BYTES)
 *     const ttls: i32[] = new Array<i32>(DNS_RESOLVE_MAX_ADDRESSES)
 *
 *     // A command-line tool: block for at most two seconds.
 *     const count: i32 = resolveHost("example.com", 2000, 443, out, ttls)
 *
 *     // A server: the lookup rides the loop it already runs.
 *     const config: DnsConfig = new DnsConfig()
 *     const resolv: u8[] = readFileBytesSync("/etc/resolv.conf") ?? new Array<u8>(0)
 *     dnsParseResolvConf(resolv, 0, toI32(resolv.length), config)
 *     const loop: i32 = pollCreate()
 *     const client: DnsClient = new DnsClient(new DnsResolver(config, null, 4), loop, 1000)
 *     const lookup: i32 = client.start("example.com", 443, monotonicNanos())
 *     if (lookup >= 0) {
 *       const ready: i32[] = new Array<i32>(16)
 *       let status: i32 = client.result(lookup, out, ttls)
 *       while (status === DNS_RESOLVE_PENDING) {
 *         const n: i32 = pollWait(loop, ready, client.timeoutMs(monotonicNanos(), -1))
 *         const now: i64 = monotonicNanos()
 *         for (let k: i32 = 0; k < n; k++) {
 *           if (client.owns(ready[2 * k])) {
 *             client.ready(ready[2 * k], ready[2 * k + 1], now)
 *           }
 *         }
 *         client.tick(now)
 *         status = client.result(lookup, out, ttls)
 *       }
 *       // status: the address count, 18 bytes each in out, or a DNS_RESOLVE_* code
 *     }
 *
 * **`DnsClient` is for a program with a loop.** It opens a fresh UDP socket
 * on a kernel-chosen port for every UDP try and a TCP connection for every
 * TCP one, watches each under a token of the range it was given, and closes
 * it when the try ends. It never waits, never reads the clock and never
 * reads a file: the caller's loop owns all three, so a lookup costs a server
 * nothing while it waits. Each send's query ID is drawn from
 * `crypto.getRandomValues`, and every buffer it uses is made in its
 * constructor.
 *
 * **`resolveHost` and `dnsLookupWith` block the thread**, on a poll loop of
 * their own, so they are for a command-line tool or a program's start-up.
 *
 * **The caller owns `out` and `ttls`.** Both need room for
 * `DNS_RESOLVE_MAX_ADDRESSES` entries (18 bytes each in `out`), or the call
 * that reads the answer panics; they are written only when it answers a
 * count. Reading a finished lookup's answer frees its slot, so read it once.
 *
 * **Errors are negative numbers.** `start` answers `DNS_RESOLVE_BUSY` when
 * every slot is in use or the `DNS_ERR_*` code of a name that is not one; a
 * finished lookup answers `DNS_RESOLVE_NOT_FOUND`, `DNS_RESOLVE_NO_ANSWER` or
 * `DNS_RESOLVE_CNAME`. A socket that cannot be opened, written or connected
 * fails that one try, counted in `socketFailures`, and the query moves to
 * the next server. A token outside the client's range, a negative token base
 * and an `out` or `ttls` that is too short are bugs in the caller and panic.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 */

import { DNS_ADDRESS_BYTES } from "nish/net/dns-message"
import { DnsConfig, DnsHosts, dnsParseHosts, dnsParseResolvConf } from "nish/net/dns-config"
import {
  DNS_CLOSE,
  DNS_OUTGOING_MAX_BYTES,
  DNS_RESOLVE_MAX_ADDRESSES,
  DNS_RESOLVE_PENDING,
  DNS_RESOLVE_TIMEOUT,
  DNS_SEND_TCP,
  DnsResolver,
} from "nish/net/dns-resolver"
import {
  connectResult,
  netClose,
  netRead,
  netWrite,
  pollAdd,
  pollCreate,
  pollModify,
  pollWait,
  tcpConnect,
  udpBind,
  udpRecvFrom,
  udpSendTo,
} from "nish:net"
import { readFileBytesSync } from "nish:fs"
import { monotonicNanos } from "nish:process"

/**
 * The longest datagram a UDP try reads, in bytes; a longer one is cut, fails
 * to parse and is dropped. A TCP try reads its stream in chunks of this size.
 */
export const DNS_UDP_MAX_REPLY: i32 = 4096

/**
 * The most datagrams one `ready` reads from a query's socket. The loop is
 * level-triggered, so the rest wait for the next `pollWait`, and a flood on
 * the port cannot hold the caller's loop inside the client.
 */
export const DNS_CLIENT_MAX_DATAGRAMS: i32 = 32

/** What a query's socket is doing: none open, a UDP try, a TCP try connecting or writing, one reading. */
const DNS_FD_NONE: i32 = 0
const DNS_FD_UDP: i32 = 1
const DNS_FD_TCP_WRITE: i32 = 2
const DNS_FD_TCP_READ: i32 = 3

/**
 * A `DnsResolver` driven on the caller's loop. Its sockets are watched under
 * tokens `tokenBase` to `tokenBase + tokens() - 1`, one per query, and the
 * caller hands every ready pair in that range to `ready`.
 */
export class DnsClient {
  /** The core; `start`, `result` and `cancel` go through the client so its sockets follow. */
  resolver: DnsResolver
  /**
   * Each query's socket, or -1.
   * @internal Used by `dnsClientClose`, `dnsClientSendUdp`, `dnsClientOpenTcp`, `dnsClientReadDatagrams` and `dnsClientReadStream` in this module.
   */
  fds: i32[]
  /**
   * What each query's socket is doing, a `DNS_FD_*`.
   * @internal Used by `dnsClientClose`, `dnsClientSendUdp`, `dnsClientOpenTcp`, `dnsClientWrite` and `dnsClientReadStream` in this module.
   */
  fdState: i32[]
  /**
   * Each query's TCP bytes, length prefix first, kept until they are all written.
   * @internal Used by `dnsClientOpenTcp` and `dnsClientWrite` in this module.
   */
  outputs: u8[][]
  /** @internal Used by `dnsClientOpenTcp` and `dnsClientWrite` in this module. */
  outputLength: i32[]
  /** @internal Used by `dnsClientOpenTcp` and `dnsClientWrite` in this module. */
  outputSent: i32[]
  /**
   * Scratch for `nextOutgoing`, a read, a sender's address and the ID.
   * @internal Used by `dnsClientSendUdp` and `dnsClientOpenTcp` in this module.
   */
  out: u8[]
  /** @internal Used by `dnsClientSendUdp` and `dnsClientOpenTcp` in this module. */
  to: u8[]
  /** @internal Used by `dnsClientSendUdp` and `dnsClientOpenTcp` in this module. */
  meta: i32[]
  /** @internal Used by `dnsClientReadDatagrams` and `dnsClientReadStream` in this module. */
  buf: u8[]
  /** @internal Used by `dnsClientReadDatagrams` in this module. */
  from: u8[]
  /** @internal Used by `dnsClientReadDatagrams` in this module. */
  recvMeta: i32[]
  private idBytes: u8[]
  /** Whether `idBytes` holds an ID no send has used yet. */
  private idFresh: boolean = false
  /** @internal Used by `dnsClientSendUdp`, `dnsClientOpenTcp` and `dnsClientWrite` in this module. */
  loop: i32 = 0
  /** The first of the client's tokens; its sockets use `tokenBase` to `tokenBase + tokens() - 1`. */
  tokenBase: i32 = 0
  /** Sockets that could not be opened, written or connected, each a failed try. */
  socketFailures: i32 = 0
  /** Sockets opened, UDP and TCP, one per try. */
  socketsOpened: i32 = 0

  /**
   * A client for `resolver` whose sockets join the loop `loop` under tokens
   * from `tokenBase`. Every buffer the client uses is made here, one TCP
   * output buffer per query among them. Panics when `tokenBase` is negative.
   *
   * @param resolver The core the client drives; the client owns it from now on, so go through
   *   the client's `start`, `result` and `cancel` rather than the resolver's.
   * @param loop The `pollCreate` loop the client's sockets join; the caller keeps it and closes it.
   * @param tokenBase The first of `tokens()` consecutive tokens the client watches its sockets
   *   under; pick a range none of the caller's own sockets use.
   */
  constructor(resolver: DnsResolver, loop: i32, tokenBase: i32) {
    if (tokenBase < 0) {
      panic(`DnsClient: a token base of ${tokenBase} is negative`)
    }
    const n: i32 = resolver.maxLookups * 2
    this.resolver = resolver
    this.loop = loop
    this.tokenBase = tokenBase
    this.fds = new Array<i32>(n)
    this.fds.fill(-1)
    this.fdState = new Array<i32>(n)
    this.outputs = []
    let q: i32 = 0
    while (q < n) {
      this.outputs.push(new Array<u8>(DNS_OUTGOING_MAX_BYTES))
      q += 1
    }
    this.outputLength = new Array<i32>(n)
    this.outputSent = new Array<i32>(n)
    this.out = new Array<u8>(DNS_OUTGOING_MAX_BYTES)
    this.to = new Array<u8>(DNS_ADDRESS_BYTES)
    this.meta = new Array<i32>(2)
    this.buf = new Array<u8>(DNS_UDP_MAX_REPLY)
    this.from = new Array<u8>(DNS_ADDRESS_BYTES)
    this.recvMeta = new Array<i32>(2)
    this.idBytes = new Array<u8>(2)
  }

  /**
   * How many tokens, from `tokenBase`, the client's sockets use: two per
   * lookup slot, one for the A query and one for the AAAA query.
   *
   * @returns The width of the client's token range.
   */
  tokens(): i32 {
    return this.resolver.maxLookups * 2
  }

  /**
   * Whether `token` is one of the client's, so the caller knows which ready
   * pairs from `pollWait` to hand to `ready`.
   *
   * @param token A token `pollWait` reported.
   * @returns True when `token` lies in `tokenBase` to `tokenBase + tokens() - 1`.
   */
  owns(token: i32): boolean {
    return token >= this.tokenBase && token - this.tokenBase < this.tokens()
  }

  /**
   * `DnsResolver.start`, with its first packets sent. `localhost`, an address
   * literal and a hosts entry finish at once, so `result` has their answer
   * straight away.
   *
   * @param name The name to look up, as the search list and `ndots` will read it.
   * @param port The port, 0 to 65535, written into every address the lookup answers; any other
   *   value panics.
   * @param nowNanos The caller's monotonic clock now, in nanoseconds.
   * @returns The lookup's id, 0 or more, to pass to `result` and `cancel`; or `DNS_RESOLVE_BUSY`
   *   when every slot is in use, or the negative `DNS_ERR_*` code of a name that is not one.
   */
  start(name: string, port: i32, nowNanos: i64): i32 {
    const lookup: i32 = this.resolver.start(name, port, nowNanos)
    this.pump(nowNanos)
    return lookup
  }

  /**
   * `DnsResolver.result`; a finished lookup's sockets are already closed.
   * Answering a finished lookup frees its slot, so a second call for it, or
   * one for an id `start` did not give out, panics.
   *
   * @param lookup An id `start` answered.
   * @param out Where the addresses go, 18 bytes each from offset 0, A first, with the lookup's
   *   port; it needs room for `DNS_RESOLVE_MAX_ADDRESSES`, or this panics.
   * @param ttls Where each address's TTL goes, in seconds; room for
   *   `DNS_RESOLVE_MAX_ADDRESSES`, or this panics.
   * @returns `DNS_RESOLVE_PENDING` while the lookup runs; once it has finished, the count of
   *   addresses written, or a negative `DNS_RESOLVE_*` code.
   */
  result(lookup: i32, out: u8[], ttls: i32[]): i32 {
    return this.resolver.result(lookup, out, ttls)
  }

  /**
   * `DnsResolver.cancel`, closing the lookup's sockets now and freeing its
   * slot, whether or not it had finished. Panics for an id that is not a
   * lookup in progress, as `result` does.
   *
   * @param lookup An id `start` answered whose answer has not been read.
   * @param nowNanos The caller's monotonic clock now, in nanoseconds.
   */
  cancel(lookup: i32, nowNanos: i64): void {
    this.resolver.cancel(lookup)
    this.pump(nowNanos)
  }

  /**
   * The pair `token`, `events` that `pollWait` reported at `nowNanos`, for a
   * token `owns` answers true for: reads the datagrams (at most
   * `DNS_CLIENT_MAX_DATAGRAMS`) or stream bytes that are waiting, finishes a
   * connection or a write, and sends whatever the core asks next. Panics for a token that is not the client's.
   * A token whose try has already ended is ignored.
   *
   * @param token The ready token, one `owns` answers true for.
   * @param events The events `pollWait` reported with it: 1 readable, 2 writable, with 4 added
   *   for a hang-up or an error.
   * @param nowNanos The caller's monotonic clock now, in nanoseconds.
   */
  ready(token: i32, events: i32, nowNanos: i64): void {
    if (!this.owns(token)) {
      panic(`DnsClient.ready: the token ${token} is not the client's`)
    }
    const q: i32 = token - this.tokenBase
    const fd: i32 = this.fds[q]
    if (fd < 0) {
      return
    }
    const state: i32 = this.fdState[q]
    if (state === DNS_FD_UDP) {
      dnsClientReadDatagrams(this, q, fd, nowNanos)
    } else if (state === DNS_FD_TCP_WRITE) {
      dnsClientWrite(this, q, fd, nowNanos)
    } else if (state === DNS_FD_TCP_READ) {
      dnsClientReadStream(this, q, fd, (events & 4) !== 0, nowNanos)
    }
    this.pump(nowNanos)
  }

  /**
   * `DnsResolver.tick`, then whatever it asks to send: every try past its
   * deadline moves to the next server. Call it after each wake of the loop.
   *
   * @param nowNanos The caller's monotonic clock now, in nanoseconds.
   */
  tick(nowNanos: i64): void {
    this.resolver.tick(nowNanos)
    this.pump(nowNanos)
  }

  /**
   * The `pollWait` timeout for a caller who would otherwise wait `ownMs`
   * (negative for ever): the smaller of it and the milliseconds, rounded up,
   * to the core's next deadline after `nowNanos`.
   *
   * @param nowNanos The caller's monotonic clock now, in nanoseconds.
   * @param ownMs How long the caller would wait for its own sake, in milliseconds, or negative
   *   to wait for ever.
   * @returns The milliseconds to pass to `pollWait`: 0 when a deadline has already passed,
   *   `ownMs` itself when the client has no try in flight.
   */
  timeoutMs(nowNanos: i64, ownMs: i32): i32 {
    const deadline: i64 = this.resolver.nextDeadlineNanos()
    if (deadline < 0) {
      return ownMs
    }
    let wait: i64 = 0
    if (deadline > nowNanos) {
      wait = (deadline - nowNanos + 999999) / 1000000
    }
    if (ownMs >= 0 && toI64(ownMs) < wait) {
      return ownMs
    }
    return toI32(wait)
  }

  /**
   * Carries out everything the core has queued: opens, sends and closes sockets.
   * @internal Used by `dnsClientReadDatagrams` and `dnsClientReadStream` in this module.
   */
  pump(nowNanos: i64): void {
    let q: i32 = this.nextOutgoing()
    while (q >= 0 && q < toI32(this.fds.length)) {
      dnsClientClose(this, q)
      const kind: i32 = this.meta[0]
      if (kind === DNS_SEND_TCP) {
        dnsClientOpenTcp(this, q, nowNanos)
      } else if (kind !== DNS_CLOSE) {
        dnsClientSendUdp(this, q, nowNanos)
      }
      q = this.nextOutgoing()
    }
  }

  /**
   * The core's next piece of work, with a random ID no send has used: one is
   * drawn only after the last went out, so an empty call or a close costs no
   * `getRandomValues`.
   */
  private nextOutgoing(): i32 {
    if (!this.idFresh) {
      crypto.getRandomValues(this.idBytes)
      this.idFresh = true
    }
    const id: i32 = (toI32(this.idBytes[0]) << 8) | toI32(this.idBytes[1])
    const q: i32 = this.resolver.nextOutgoing(this.out, this.to, this.meta, id)
    if (q >= 0 && this.meta.length > 0 && this.meta[0] !== DNS_CLOSE) {
      this.idFresh = false
    }
    return q
  }
}

/** Closes query `q`'s socket, if it has one. */
const dnsClientClose = (c: DnsClient, q: i32): void => {
  const fd: i32 = c.fds[q]
  if (fd >= 0) {
    netClose(fd)
    c.fds[q] = -1
    c.fdState[q] = DNS_FD_NONE
  }
}

/** Fails query `q`'s try because its socket did: closes it, if it opened, and tells the core. */
const dnsClientFail = (c: DnsClient, q: i32, nowNanos: i64): void => {
  c.socketFailures = dnsClientCount(c.socketFailures)
  dnsClientClose(c, q)
  c.resolver.fail(q, nowNanos)
}

/** Whether the 18-byte address `to` is IPv4, `::ffff:a.b.c.d`. */
const dnsClientIsV4 = (to: u8[]): boolean => {
  let i: i32 = 0
  while (i < 10 && i < toI32(to.length)) {
    if (to[i] !== 0) {
      return false
    }
    i += 1
  }
  return to.length >= 12 && to[10] === 0xff && to[11] === 0xff
}

/** `n` plus one, held at the i32 maximum, so a counter never overflows. */
const dnsClientCount = (n: i32): i32 => (n < 2147483647 ? n + 1 : n)

/** Sends `c.out` to `c.to` from a new socket on a port the kernel picks, watched for reading. */
const dnsClientSendUdp = (c: DnsClient, q: i32, nowNanos: i64): void => {
  const fd: i32 = udpBind(dnsClientIsV4(c.to) ? "0.0.0.0" : "::", 0, 0)
  if (fd < 0) {
    dnsClientFail(c, q, nowNanos)
    return
  }
  c.socketsOpened = dnsClientCount(c.socketsOpened)
  c.fds[q] = fd
  c.fdState[q] = DNS_FD_UDP
  const length: i32 = c.meta[1]
  if (
    udpSendTo(fd, c.out, 0, length, c.to, 0, 0) !== length ||
    pollAdd(c.loop, fd, 1, c.tokenBase + q) !== 0
  ) {
    dnsClientFail(c, q, nowNanos)
  }
}

/** Starts a connection to `c.to`, watched for writing, and keeps `c.out` to write once it is made. */
const dnsClientOpenTcp = (c: DnsClient, q: i32, nowNanos: i64): void => {
  const fd: i32 = tcpConnect(c.to)
  if (fd < 0) {
    dnsClientFail(c, q, nowNanos)
    return
  }
  c.socketsOpened = dnsClientCount(c.socketsOpened)
  c.fds[q] = fd
  c.fdState[q] = DNS_FD_TCP_WRITE
  const length: i32 = c.meta[1]
  const output: u8[] = c.outputs[q]
  let i: i32 = 0
  while (i < length && i < toI32(output.length) && i < toI32(c.out.length)) {
    output[i] = c.out[i]
    i += 1
  }
  c.outputLength[q] = length
  c.outputSent[q] = 0
  if (pollAdd(c.loop, fd, 2, c.tokenBase + q) !== 0) {
    dnsClientFail(c, q, nowNanos)
  }
}

/**
 * The datagrams waiting on query `q`'s socket, to the core, until none is,
 * the try ends or `DNS_CLIENT_MAX_DATAGRAMS` are read.
 */
const dnsClientReadDatagrams = (c: DnsClient, q: i32, fd: i32, nowNanos: i64): void => {
  let read: i32 = 0
  while (c.fds[q] === fd && read < DNS_CLIENT_MAX_DATAGRAMS) {
    const n: i32 = udpRecvFrom(fd, c.buf, 0, DNS_UDP_MAX_REPLY, c.from, c.recvMeta)
    if (n < 0) {
      return
    }
    read += 1
    c.resolver.receive(q, c.buf, n, c.from, nowNanos)
    c.pump(nowNanos)
  }
}

/**
 * Query `q`'s connection is writable: on the first time, whether it was
 * made; then as much of the query as the socket takes, and once all of it
 * is written, the socket watched for reading instead.
 */
const dnsClientWrite = (c: DnsClient, q: i32, fd: i32, nowNanos: i64): void => {
  if (c.outputSent[q] === 0 && connectResult(fd) !== 0) {
    dnsClientFail(c, q, nowNanos)
    return
  }
  while (c.outputSent[q] < c.outputLength[q]) {
    const n: i32 = netWrite(fd, c.outputs[q], c.outputSent[q], c.outputLength[q] - c.outputSent[q])
    if (n === -11) {
      return
    }
    if (n <= 0) {
      dnsClientFail(c, q, nowNanos)
      return
    }
    c.outputSent[q] = c.outputSent[q] + n
  }
  c.fdState[q] = DNS_FD_TCP_READ
  if (pollModify(c.loop, fd, 1, c.tokenBase + q) !== 0) {
    dnsClientFail(c, q, nowNanos)
  }
}

/**
 * The bytes waiting on query `q`'s connection, to the core, until none are or
 * the try ends. The end of the stream, or a hang-up with nothing left to
 * read, before the reply is whole fails the try. A try the core ended stops
 * the reading, though the next one may open its socket on the same fd.
 */
const dnsClientReadStream = (c: DnsClient, q: i32, fd: i32, hungUp: boolean, nowNanos: i64): void => {
  while (c.fds[q] === fd && c.fdState[q] === DNS_FD_TCP_READ) {
    const n: i32 = netRead(fd, c.buf, 0, DNS_UDP_MAX_REPLY)
    if (n === -11 && !hungUp) {
      return
    }
    if (n <= 0) {
      dnsClientFail(c, q, nowNanos)
      return
    }
    c.resolver.receiveStream(q, c.buf, n, nowNanos)
    c.pump(nowNanos)
  }
}

/**
 * The addresses of `name`, looked up as `/etc/resolv.conf` and `/etc/hosts`
 * say (a missing resolv.conf means the defaults, a missing hosts file no
 * entries), each 18 bytes with `port` into `out` and its TTL in seconds into
 * `ttls`. It waits for both the A and the AAAA answer, so a family that
 * answered is not returned on its own once `timeoutMs` passes: it is
 * `DNS_RESOLVE_TIMEOUT`.
 *
 * **It blocks the thread** until the lookup ends, on a loop of its own, so
 * it is for a CLI or a program's start-up; a server resolves with a
 * `DnsClient` on its own loop. `out` and `ttls` need room for
 * `DNS_RESOLVE_MAX_ADDRESSES`, or it panics. Each call reads both files and
 * makes its own configuration, resolver and loop, closing the loop before
 * it returns.
 *
 * @param name The name to look up; `localhost`, an address literal and a hosts entry answer
 *   without a packet, even with a `timeoutMs` of 0.
 * @param timeoutMs The most the whole lookup may take, in milliseconds, on the monotonic clock.
 * @param port The port, 0 to 65535, written into every address; any other value panics.
 * @param out Where the addresses go, from offset 0, A first; at least
 *   `DNS_RESOLVE_MAX_ADDRESSES * 18` bytes.
 * @param ttls Where each address's TTL goes, in seconds; at least `DNS_RESOLVE_MAX_ADDRESSES`.
 * @returns The count of addresses written; or a negative code: `DNS_RESOLVE_TIMEOUT` once
 *   `timeoutMs` has passed, `DNS_RESOLVE_NOT_FOUND`, `DNS_RESOLVE_NO_ANSWER` or
 *   `DNS_RESOLVE_CNAME` from the lookup, the `DNS_ERR_*` code of a name that is not one, or
 *   the negative errno of a poll loop that cannot be made or waited on.
 */
export const resolveHost = (name: string, timeoutMs: i32, port: i32, out: u8[], ttls: i32[]): i32 => {
  const config: DnsConfig = new DnsConfig()
  const hosts: DnsHosts = new DnsHosts()
  dnsLoadSystem(config, hosts)
  return dnsLookupWith(config, hosts, name, timeoutMs, port, out, ttls)
}

/**
 * Reads the system's resolver settings the way `resolveHost` does:
 * `/etc/resolv.conf` into `config` (a missing file means the defaults) and
 * `/etc/hosts` into `hosts` (a missing file adds no entry). A driver of its
 * own, such as the async `fetch`'s, starts from this so every lookup in a
 * program honours the same files.
 *
 * @param config A fresh `DnsConfig` to fill.
 * @param hosts A fresh `DnsHosts` to fill.
 */
export const dnsLoadSystem = (config: DnsConfig, hosts: DnsHosts): void => {
  const conf: u8[] | null = readFileBytesSync("/etc/resolv.conf")
  if (conf !== null) {
    dnsParseResolvConf(conf, 0, toI32(conf.length), config)
  } else {
    dnsParseResolvConf(new Array<u8>(0), 0, 0, config)
  }
  const hostsFile: u8[] | null = readFileBytesSync("/etc/hosts")
  if (hostsFile !== null) {
    dnsParseHosts(hostsFile, 0, toI32(hostsFile.length), hosts)
  }
}

/**
 * `resolveHost` with the configuration given rather than read: one lookup
 * of `name` on a loop of its own, for at most `timeoutMs`. Blocks as
 * `resolveHost` does, and reads no file. `config` and `hosts` are only read,
 * so one pair can serve many calls.
 *
 * @param config The resolv.conf to use, as `dnsParseResolvConf` filled it.
 * @param hosts The hosts file to consult first, as `dnsParseHosts` filled it, or null for none.
 * @param name The name to look up.
 * @param timeoutMs The most the whole lookup may take, in milliseconds, on the monotonic clock.
 * @param port The port, 0 to 65535, written into every address; any other value panics.
 * @param out Where the addresses go, from offset 0, A first; at least
 *   `DNS_RESOLVE_MAX_ADDRESSES * 18` bytes, or this panics.
 * @param ttls Where each address's TTL goes, in seconds; at least `DNS_RESOLVE_MAX_ADDRESSES`,
 *   or this panics.
 * @returns What `resolveHost` answers: the address count, or a negative `DNS_RESOLVE_*`,
 *   `DNS_ERR_*` or errno code.
 */
export const dnsLookupWith = (
  config: DnsConfig,
  hosts: DnsHosts | null,
  name: string,
  timeoutMs: i32,
  port: i32,
  out: u8[],
  ttls: i32[]
): i32 => {
  if (
    toI32(out.length) < DNS_RESOLVE_MAX_ADDRESSES * DNS_ADDRESS_BYTES ||
    toI32(ttls.length) < DNS_RESOLVE_MAX_ADDRESSES
  ) {
    panic("resolveHost: out or ttls has no room for DNS_RESOLVE_MAX_ADDRESSES")
  }
  const loop: i32 = pollCreate()
  if (loop < 0) {
    return loop
  }
  const client: DnsClient = new DnsClient(new DnsResolver(config, hosts, 1), loop, 0)
  const begun: i64 = monotonicNanos()
  const end: i64 = begun + toI64(timeoutMs) * 1000000
  const lookup: i32 = client.start(name, port, begun)
  if (lookup < 0) {
    netClose(loop)
    return lookup
  }
  const ready: i32[] = new Array<i32>(8)
  let status: i32 = client.result(lookup, out, ttls)
  while (status === DNS_RESOLVE_PENDING) {
    const now: i64 = monotonicNanos()
    if (now >= end) {
      client.cancel(lookup, now)
      status = DNS_RESOLVE_TIMEOUT
      break
    }
    const own: i32 = toI32((end - now + 999999) / 1000000)
    const count: i32 = pollWait(loop, ready, client.timeoutMs(now, own))
    if (count < 0) {
      // A signal answers 0, so a negative count is the loop failing: waiting again would spin.
      client.cancel(lookup, now)
      status = count
      break
    }
    const after: i64 = monotonicNanos()
    let k: i32 = 0
    while (k < count && 2 * k + 1 < toI32(ready.length)) {
      if (client.owns(ready[2 * k])) {
        client.ready(ready[2 * k], ready[2 * k + 1], after)
      }
      k += 1
    }
    client.tick(after)
    status = client.result(lookup, out, ttls)
  }
  netClose(loop)
  return status
}
