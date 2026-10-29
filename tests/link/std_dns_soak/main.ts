// `nish/net/dns` holds its arena flat across lookups: a `DnsClient` resolves
// `www.test` (A and AAAA over UDP) against a loopback server, 300 lookups to
// warm up and 2,000 past them, and `Arena.used()` and `Arena.mark()` read the
// same after the last as after the warm-up. The server answers in place, in one
// buffer it never grows, so what moves the arena is the resolver's alone: a
// lookup that kept a byte of its own would show here as 2,000 of them.
import { DNS_RESOLVE_PENDING, DnsResolver } from "nish/net/dns-resolver"
import { DnsClient } from "nish/net/dns"
import { DnsConfig, dnsParseResolvConf } from "nish/net/dns-config"
import { DNS_ADDRESS_BYTES } from "nish/net/dns-message"
import { setU16BE } from "nish/bytes"
import { netLocalPort, pollAdd, pollCreate, pollWait, udpBind, udpRecvFrom, udpSendTo } from "nish:net"
import { monotonicNanos } from "nish:process"
import { Suite } from "nish/testing"

const WARMUP: i32 = 300
const MEASURED: i32 = 2000
const SERVER_TOKEN: i32 = 1
const WOULD_BLOCK: i32 = -11

/** The loopback server: one socket, one buffer, an answer written over the query. */
class Server {
  fd: i32 = -1
  port: i32 = 0
  buf: u8[]
  from: u8[]
  meta: i32[]
  answered: i32 = 0

  constructor() {
    this.buf = new Array<u8>(512)
    this.from = new Array<u8>(DNS_ADDRESS_BYTES)
    this.meta = new Array<i32>(2)
  }
}

/**
 * Answers every waiting query with one record of the type it asks, written
 * after the question: 192.0.2.1 for A, 2001:db8::1 for AAAA, TTL 300.
 */
const serve = (s: Server): void => {
  let len: i32 = udpRecvFrom(s.fd, s.buf, 0, 400, s.from, s.meta)
  while (len !== WOULD_BLOCK) {
    if (len >= 17) {
      // The question's type is the two bytes after its name, which ends at the first zero label.
      let at: i32 = 12
      while (at < len && s.buf[at] !== 0) {
        at += toI32(s.buf[at]) + 1
      }
      const aaaa: boolean = at + 2 < len && s.buf[at + 2] === 28
      const rdlen: i32 = aaaa ? 16 : 4
      s.buf[2] = 0x81
      s.buf[3] = 0x80
      s.buf[7] = 1
      let w: i32 = at + 5
      s.buf[w] = 0xc0
      s.buf[w + 1] = 12
      s.buf[w + 2] = 0
      s.buf[w + 3] = aaaa ? 28 : 1
      s.buf[w + 4] = 0
      s.buf[w + 5] = 1
      s.buf[w + 6] = 0
      s.buf[w + 7] = 0
      s.buf[w + 8] = 1
      s.buf[w + 9] = 0x2c
      s.buf[w + 10] = 0
      s.buf[w + 11] = toU8(rdlen)
      w += 12
      let k: i32 = 0
      while (k < rdlen) {
        s.buf[w + k] = 0
        k += 1
      }
      if (aaaa) {
        s.buf[w] = 0x20
        s.buf[w + 1] = 0x01
        s.buf[w + 2] = 0x0d
        s.buf[w + 3] = 0xb8
        s.buf[w + 15] = 1
      } else {
        s.buf[w] = 192
        s.buf[w + 2] = 2
        s.buf[w + 3] = 1
      }
      udpSendTo(s.fd, s.buf, 0, w + rdlen, s.from, 0, 0)
      s.answered += 1
    }
    len = udpRecvFrom(s.fd, s.buf, 0, 400, s.from, s.meta)
  }
}

/** One lookup of www.test driven to its end on `loop`; its result, or PENDING if two seconds pass. */
const lookupOnce = (s: Server, c: DnsClient, loop: i32, ready: i32[], out: u8[], ttls: i32[]): i32 => {
  const begun: i64 = monotonicNanos()
  const end: i64 = begun + toI64(2000) * 1000000
  const lookup: i32 = c.start("www.test", 443, begun)
  let status: i32 = c.result(lookup, out, ttls)
  while (status === DNS_RESOLVE_PENDING && monotonicNanos() < end) {
    const count: i32 = pollWait(loop, ready, c.timeoutMs(monotonicNanos(), 100))
    const now: i64 = monotonicNanos()
    let k: i32 = 0
    while (k < count) {
      const token: i32 = ready[2 * k]
      if (c.owns(token)) {
        c.ready(token, ready[2 * k + 1], now)
      } else if (token === SERVER_TOKEN) {
        serve(s)
      }
      k += 1
    }
    c.tick(monotonicNanos())
    status = c.result(lookup, out, ttls)
  }
  return status
}

/** `count` lookups; how many of them did not end with two addresses. */
const lookups = (count: i32, s: Server, c: DnsClient, loop: i32, ready: i32[], out: u8[], ttls: i32[]): i32 => {
  let bad: i32 = 0
  let i: i32 = 0
  while (i < count) {
    if (lookupOnce(s, c, loop, ready, out, ttls) !== 2) {
      bad += 1
    }
    i += 1
  }
  return bad
}

export const main = (): number => {
  const t = new Suite("dns soak")
  const loop: i32 = pollCreate()
  const s: Server = new Server()
  s.fd = udpBind("127.0.0.1", 0, 0)
  if (loop < 0 || s.fd < 0 || pollAdd(loop, s.fd, 1, SERVER_TOKEN) !== 0) {
    t.fail("setup: the loopback server is listening", `${loop} ${s.fd}`)
    return t.done()
  }
  s.port = netLocalPort(s.fd)

  const text: string = "nameserver 127.0.0.1\noptions timeout:1 attempts:1\n"
  const conf: u8[] = new Array<u8>(text.length)
  let i: i32 = 0
  while (i < text.length && i < conf.length) {
    conf[i] = toU8(text.charCodeAt(i))
    i += 1
  }
  const config: DnsConfig = new DnsConfig()
  dnsParseResolvConf(conf, 0, toI32(conf.length), config)
  setU16BE(config.servers, 16, toU16(s.port))
  const c: DnsClient = new DnsClient(new DnsResolver(config, null, 7), loop, 100)

  const ready: i32[] = new Array<i32>(32)
  const out: u8[] = new Array<u8>(32 * DNS_ADDRESS_BYTES)
  const ttls: i32[] = new Array<i32>(32)

  t.eqI32(`warm-up: ${WARMUP} lookups each give two addresses`, lookups(WARMUP, s, c, loop, ready, out, ttls), 0)
  // Nothing between the two readings but the lookups: the labels are built after.
  const mark: i64 = Arena.mark()
  const used: i64 = Arena.used()
  const bad: i32 = lookups(MEASURED, s, c, loop, ready, out, ttls)
  const markAfter: i64 = Arena.mark()
  const usedAfter: i64 = Arena.used()
  t.eqI32(`soak: ${MEASURED} more each give two addresses`, bad, 0)
  t.eqI32("soak: the server answered both queries of every lookup", s.answered, 2 * (WARMUP + MEASURED))
  if (markAfter === mark && usedAfter === used) {
    t.pass(`soak: Arena.used() flat over ${MEASURED} lookups past warm-up`)
  } else {
    t.fail(
      `soak: Arena.used() flat over ${MEASURED} lookups past warm-up`,
      `after warm-up: mark ${mark} used ${used}; after ${MEASURED} more: mark ${markAfter} used ${usedAfter}`
    )
  }
  t.eqI32("soak: no lookup timed out", c.resolver.timeouts, 0)
  return t.done()
}
