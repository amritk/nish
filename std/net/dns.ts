/**
 * `nish/net/dns` — the stub resolver of `nish/net/dns-resolver` driven over
 * `nish:net` sockets on the caller's own readiness loop, and `resolveHost`,
 * which runs a loop of its own for a program that has none.
 *
 *     const client = new DnsClient(new DnsResolver(config, hosts, 4), loop, 1000);
 *     const lookup = client.start("example.com", 443, monotonicNanos());
 *     // in the loop: pollWait(loop, ready, client.timeoutMs(now, own)); hand
 *     // each token client.owns to client.ready, call client.tick(now), and
 *     // read client.result(lookup, out, ttls) until it is not PENDING.
 *
 * `DnsClient` opens a fresh UDP socket on a kernel-chosen port for every UDP
 * try and a TCP connection for every TCP one, watches each under a token of
 * the range it was given, and closes it when the try ends. It never waits,
 * never reads the clock and never reads a file: the caller's loop owns all
 * three, so a lookup costs a server nothing while it waits. Each send's
 * query ID is drawn from `crypto.getRandomValues`.
 *
 * This is the non-blocking resolver. `netResolve`, where a build has it, is
 * the C library's `getaddrinfo`, which blocks the thread that calls it.
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

/** The longest datagram a UDP try reads; a longer one is cut, fails to parse and is dropped. */
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
  /** Each query's socket, or -1. */
  fds: i32[]
  /** What each query's socket is doing, a `DNS_FD_*`. */
  fdState: i32[]
  /** Each query's TCP bytes, length prefix first, kept until they are all written. */
  outputs: u8[][]
  outputLength: i32[]
  outputSent: i32[]
  /** Scratch for `nextOutgoing`, a read, a sender's address and the ID. */
  out: u8[]
  to: u8[]
  meta: i32[]
  buf: u8[]
  from: u8[]
  recvMeta: i32[]
  idBytes: u8[]
  loop: i32 = 0
  tokenBase: i32 = 0
  /** Sockets that could not be opened, written or connected, each a failed try. */
  socketFailures: i32 = 0

  /**
   * A client for `resolver` whose sockets join the loop `loop` under tokens
   * from `tokenBase`. Panics when `tokenBase` is negative.
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

  /** How many tokens, from `tokenBase`, the client's sockets use. */
  tokens(): i32 {
    return this.resolver.maxLookups * 2
  }

  /** Whether `token` is one of the client's. */
  owns(token: i32): boolean {
    return token >= this.tokenBase && token - this.tokenBase < this.tokens()
  }

  /** `DnsResolver.start`, with its first packets sent: the lookup, or a negative error. */
  start(name: string, port: i32, nowNanos: i64): i32 {
    const lookup: i32 = this.resolver.start(name, port, nowNanos)
    this.pump(nowNanos)
    return lookup
  }

  /** `DnsResolver.result`; a finished lookup's sockets are already closed. */
  result(lookup: i32, out: u8[], ttls: i32[]): i32 {
    return this.resolver.result(lookup, out, ttls)
  }

  /** `DnsResolver.cancel`, closing the lookup's sockets. */
  cancel(lookup: i32, nowNanos: i64): void {
    this.resolver.cancel(lookup)
    this.pump(nowNanos)
  }

  /**
   * The pair `token`, `events` that `pollWait` reported at `nowNanos`, for a
   * token `owns` answers true for: reads the datagrams (at most
   * `DNS_CLIENT_MAX_DATAGRAMS`) or stream bytes that are waiting, finishes a
   * connection or a write, and sends whatever the core asks next. Panics for a token that is not the client's.
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

  /** `DnsResolver.tick`, then whatever it asks to send. */
  tick(nowNanos: i64): void {
    this.resolver.tick(nowNanos)
    this.pump(nowNanos)
  }

  /**
   * The `pollWait` timeout for a caller who would otherwise wait `ownMs`
   * (negative for ever): the smaller of it and the milliseconds, rounded up,
   * to the core's next deadline after `nowNanos`.
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

  /** Carries out everything the core has queued: opens, sends and closes sockets. */
  pump(nowNanos: i64): void {
    let q: i32 = this.nextOutgoing()
    while (q >= 0 && q < this.fds.length) {
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

  /** The core's next piece of work, with a fresh random ID. */
  nextOutgoing(): i32 {
    crypto.getRandomValues(this.idBytes)
    const id: i32 = (toI32(this.idBytes[0]) << 8) | toI32(this.idBytes[1])
    return this.resolver.nextOutgoing(this.out, this.to, this.meta, id)
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

/** Fails query `q`'s try because its socket did: closes it and tells the core. */
const dnsClientFail = (c: DnsClient, q: i32, nowNanos: i64): void => {
  c.socketFailures += 1
  dnsClientClose(c, q)
  c.resolver.fail(q, nowNanos)
}

/** Whether the 18-byte address `to` is IPv4, `::ffff:a.b.c.d`. */
const dnsClientIsV4 = (to: u8[]): boolean => {
  let i: i32 = 0
  while (i < 10 && i < to.length) {
    if (to[i] !== 0) {
      return false
    }
    i += 1
  }
  return to.length >= 12 && to[10] === 0xff && to[11] === 0xff
}

/** Sends `c.out` to `c.to` from a new socket on a port the kernel picks, watched for reading. */
const dnsClientSendUdp = (c: DnsClient, q: i32, nowNanos: i64): void => {
  const fd: i32 = udpBind(dnsClientIsV4(c.to) ? "0.0.0.0" : "::", 0, 0)
  if (fd < 0) {
    c.socketFailures += 1
    c.resolver.fail(q, nowNanos)
    return
  }
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
    c.socketFailures += 1
    c.resolver.fail(q, nowNanos)
    return
  }
  c.fds[q] = fd
  c.fdState[q] = DNS_FD_TCP_WRITE
  const length: i32 = c.meta[1]
  const output: u8[] = c.outputs[q]
  let i: i32 = 0
  while (i < length && i < output.length && i < c.out.length) {
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
 * read, before the reply is whole fails the try.
 */
const dnsClientReadStream = (c: DnsClient, q: i32, fd: i32, hungUp: boolean, nowNanos: i64): void => {
  while (c.fds[q] === fd) {
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
 * say (either missing means the defaults), each 18 bytes with `port` into
 * `out` and its TTL in seconds into `ttls`: the count, or a negative
 * `DNS_RESOLVE_*` code, `DNS_RESOLVE_TIMEOUT` once `timeoutMs` has passed.
 *
 * **It blocks the thread** until the lookup ends, on a loop of its own, so
 * it is for a CLI or a program's start-up; a server resolves with a
 * `DnsClient` on its own loop. `out` and `ttls` need room for
 * `DNS_RESOLVE_MAX_ADDRESSES`, or it panics.
 */
export const resolveHost = (name: string, timeoutMs: i32, port: i32, out: u8[], ttls: i32[]): i32 => {
  const config: DnsConfig = new DnsConfig()
  const conf: u8[] | null = readFileBytesSync("/etc/resolv.conf")
  if (conf !== null) {
    dnsParseResolvConf(conf, 0, toI32(conf.length), config)
  } else {
    dnsParseResolvConf(new Array<u8>(0), 0, 0, config)
  }
  const hosts: DnsHosts = new DnsHosts()
  const hostsFile: u8[] | null = readFileBytesSync("/etc/hosts")
  if (hostsFile !== null) {
    dnsParseHosts(hostsFile, 0, toI32(hostsFile.length), hosts)
  }
  return dnsLookupWith(config, hosts, name, timeoutMs, port, out, ttls)
}

/**
 * `resolveHost` with the configuration given rather than read: one lookup
 * of `name` on a loop of its own, for at most `timeoutMs`. Blocks as
 * `resolveHost` does.
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
    const after: i64 = monotonicNanos()
    let k: i32 = 0
    while (k < count && 2 * k + 1 < ready.length) {
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
