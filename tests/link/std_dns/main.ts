// `nish/net/dns` end to end: a Nish DNS server on loopback, UDP and TCP on one
// port, answers a test zone, and a `DnsClient` resolves against it on the same
// `pollWait` loop the program owns. It pins A and AAAA with their TTLs, the
// TC retry over TCP, a CNAME chain, the search list, a dead server timing out
// so the next one answers, `attempts`, the hosts file and `localhost` with no
// packet, spoofed replies dropped while the genuine one completes the lookup,
// and IDs and source ports that vary.
import { DNS_RESOLVE_NO_ANSWER, DNS_RESOLVE_NOT_FOUND, DNS_RESOLVE_PENDING, DNS_RESOLVE_TIMEOUT, DnsResolver } from "nish/net/dns-resolver"
import { DnsClient, dnsLookupWith, resolveHost } from "nish/net/dns"
import { DnsConfig, DnsHosts, dnsParseHosts, dnsParseResolvConf } from "nish/net/dns-config"
import { DNS_ADDRESS_BYTES, DNS_TYPE_A, DNS_TYPE_AAAA, DNS_TYPE_CNAME } from "nish/net/dns-message"
import { setU16BE } from "nish/bytes"
import {
  netClose,
  netLocalPort,
  netRead,
  netWrite,
  pollAdd,
  pollCreate,
  pollWait,
  tcpAccept,
  tcpListen,
  udpBind,
  udpRecvFrom,
  udpSendTo,
} from "nish:net"
import { monotonicNanos } from "nish:process"
import { Suite } from "nish/testing"

const HEX: string = "0123456789abcdef"
const WOULD_BLOCK: i32 = -11

/** NOERROR, RD and RA; NXDOMAIN; and NOERROR with TC set. */
const OK: i32 = 0x8180
const NXDOMAIN: i32 = 0x8183
const TRUNCATED: i32 = 0x8380

/** The server's tokens on the loop; its connections take `CONN_TOKEN + slot`. */
const UDP_TOKEN: i32 = 1
const LISTEN_TOKEN: i32 = 2
const CONN_TOKEN: i32 = 10
const CONNS: i32 = 4
const CONN_BUF: i32 = 600

const ascii = (s: string): u8[] => {
  const n: i32 = toI32(s.length)
  const out: u8[] = new Array<u8>(n)
  let i: i32 = 0
  while (i < n) {
    out[i] = toU8(toI32(s.charCodeAt(i)))
    i += 1
  }
  return out
}

const toHex = (bytes: u8[], off: i32, len: i32): string => {
  let s: string = ""
  let i: i32 = 0
  while (i < len) {
    const b: i32 = toI32(bytes[off + i])
    s = s + HEX.substring(b >> 4, (b >> 4) + 1) + HEX.substring(b & 15, (b & 15) + 1)
    i += 1
  }
  return s
}

/** `a` then `b`. */
const cat = (a: u8[], b: u8[]): u8[] => {
  const out: u8[] = new Array<u8>(a.length + b.length)
  let i: i32 = 0
  while (i < a.length) {
    out[i] = a[i]
    i += 1
  }
  let j: i32 = 0
  while (j < b.length) {
    out[i + j] = b[j]
    j += 1
  }
  return out
}

/** `b[off, off + len)` as an array of its own. */
const copy = (b: u8[], off: i32, len: i32): u8[] => {
  const out: u8[] = new Array<u8>(len)
  let i: i32 = 0
  while (i < len) {
    out[i] = b[off + i]
    i += 1
  }
  return out
}

/** `name`'s wire form, with its root byte. */
const wire = (name: string): u8[] => {
  const n: i32 = toI32(name.length)
  const out: u8[] = new Array<u8>(n + 2)
  let label: i32 = 0
  let i: i32 = 0
  while (i <= n) {
    const b: i32 = i < n ? toI32(name.charCodeAt(i)) : 46
    if (b === 46) {
      out[label] = toU8(i - label)
      label = i + 1
    } else {
      out[i + 1] = toU8(b)
    }
    i += 1
  }
  out[n + 1] = toU8(0)
  return out
}

/** A pointer to the question's name, which every reply carries at offset 12. */
const atQuestion = (): u8[] => {
  const out: u8[] = new Array<u8>(2)
  out[0] = toU8(0xc0)
  out[1] = toU8(12)
  return out
}

/** One answer record: `owner` (wire form), `rtype`, class IN, `ttl`, `rdata`. */
const record = (owner: u8[], rtype: i32, ttl: i32, rdata: u8[]): u8[] => {
  const fixed: u8[] = new Array<u8>(10)
  setU16BE(fixed, 0, toU16(rtype))
  setU16BE(fixed, 2, toU16(1))
  setU16BE(fixed, 4, toU16(ttl >> 16))
  setU16BE(fixed, 6, toU16(ttl & 0xffff))
  setU16BE(fixed, 8, toU16(toI32(rdata.length)))
  return cat(cat(owner, fixed), rdata)
}

const v4 = (a: i32, b: i32, c: i32, d: i32): u8[] => {
  const out: u8[] = new Array<u8>(4)
  out[0] = toU8(a)
  out[1] = toU8(b)
  out[2] = toU8(c)
  out[3] = toU8(d)
  return out
}

/** 2001:db8::`last`. */
const v6 = (last: i32): u8[] => {
  const out: u8[] = new Array<u8>(16)
  out.fill(toU8(0))
  out[0] = toU8(0x20)
  out[1] = toU8(0x01)
  out[2] = toU8(0x0d)
  out[3] = toU8(0xb8)
  out[15] = toU8(last)
  return out
}

/** The test zone's answer to `name` and `qtype`: its records, with the flags and count in `head`. */
const zone = (name: string, qtype: i32, overTcp: boolean, head: i32[]): u8[] => {
  head[0] = OK
  head[1] = 1
  const a: boolean = qtype === DNS_TYPE_A
  if (name === "www.test") {
    return a ? record(atQuestion(), DNS_TYPE_A, 300, v4(192, 0, 2, 1)) : record(atQuestion(), DNS_TYPE_AAAA, 600, v6(1))
  }
  if (name === "big.test") {
    if (!overTcp) {
      head[0] = TRUNCATED
      head[1] = 0
      return new Array<u8>(0)
    }
    return a ? record(atQuestion(), DNS_TYPE_A, 60, v4(192, 0, 2, 7)) : record(atQuestion(), DNS_TYPE_AAAA, 120, v6(7))
  }
  if (name === "alias.test") {
    head[1] = 2
    const target: u8[] = wire("www.test")
    const cname: u8[] = record(atQuestion(), DNS_TYPE_CNAME, 30, target)
    return a
      ? cat(cname, record(target, DNS_TYPE_A, 300, v4(192, 0, 2, 1)))
      : cat(cname, record(target, DNS_TYPE_AAAA, 600, v6(1)))
  }
  if (name === "host.zone.test" || name === "spoof.test") {
    if (!a) {
      head[1] = 0
      return new Array<u8>(0)
    }
    return record(atQuestion(), DNS_TYPE_A, 100, v4(192, 0, 2, name === "spoof.test" ? 4 : 3))
  }
  head[0] = NXDOMAIN
  head[1] = 0
  return new Array<u8>(0)
}

/** The dotted name a query asks, read from offset 12; its type goes to `qtype[0]` and its end to `qtype[1]`. */
const questionOf = (q: u8[], len: i32, qtype: i32[]): string => {
  let at: i32 = 12
  let name: string = ""
  while (at < len && q[at] !== toU8(0)) {
    const n: i32 = toI32(q[at])
    if (name.length > 0) {
      name = name + "."
    }
    let k: i32 = 0
    while (k < n) {
      name = name + String.fromCharCode(toI32(q[at + 1 + k]))
      k += 1
    }
    at += n + 1
  }
  qtype[0] = toI32(q[at + 1]) * 256 + toI32(q[at + 2])
  qtype[1] = at + 5
  return name
}

/** The zone's reply to the query in `q[0, len)`: its header and question copied, flags and answers set. */
const replyTo = (q: u8[], len: i32, overTcp: boolean): u8[] => {
  const qtype: i32[] = [0, 0]
  const name: string = questionOf(q, len, qtype)
  const head: i32[] = [0, 0]
  const records: u8[] = zone(name, qtype[0], overTcp, head)
  const out: u8[] = cat(copy(q, 0, qtype[1]), records)
  setU16BE(out, 2, toU16(head[0]))
  setU16BE(out, 6, toU16(head[1]))
  return out
}

/** The Nish DNS server, its spoofer and a dead server that never answers, all on loopback. */
class Server {
  udp: i32 = -1
  listener: i32 = -1
  spoofer: i32 = -1
  dead: i32 = -1
  port: i32 = 0
  deadPort: i32 = 0
  conns: i32[]
  connBufs: u8[][]
  connHave: i32[]
  /** Every UDP query's ID and source port, and the queries over each transport. */
  ids: i32[]
  ports: i32[]
  udpQueries: i32 = 0
  tcpQueries: i32 = 0
  buf: u8[]
  from: u8[]
  meta: i32[]

  constructor() {
    this.conns = new Array<i32>(CONNS)
    this.conns.fill(-1)
    this.connBufs = []
    let i: i32 = 0
    while (i < CONNS) {
      this.connBufs.push(new Array<u8>(CONN_BUF))
      i += 1
    }
    this.connHave = new Array<i32>(CONNS)
    this.ids = []
    this.ports = []
    this.buf = new Array<u8>(1500)
    this.from = new Array<u8>(DNS_ADDRESS_BYTES)
    this.meta = [0, 0]
  }
}

/** Binds the server's sockets and watches them on `loop`: 0, or the first failure. */
const serverOpen = (s: Server, loop: i32): i32 => {
  s.udp = udpBind("127.0.0.1", 0, 0)
  if (s.udp < 0) {
    return s.udp
  }
  s.port = netLocalPort(s.udp)
  s.listener = tcpListen("127.0.0.1", s.port, 8)
  s.spoofer = udpBind("127.0.0.1", 0, 0)
  s.dead = udpBind("127.0.0.1", 0, 0)
  if (s.listener < 0 || s.spoofer < 0 || s.dead < 0) {
    return -1
  }
  s.deadPort = netLocalPort(s.dead)
  if (pollAdd(loop, s.udp, 1, UDP_TOKEN) !== 0 || pollAdd(loop, s.listener, 1, LISTEN_TOKEN) !== 0) {
    return -2
  }
  return 0
}

/** Datagrams waiting on the dead server, read and counted, never answered. */
const deadQueries = (s: Server): i32 => {
  let n: i32 = 0
  while (udpRecvFrom(s.dead, s.buf, 0, toI32(s.buf.length), s.from, s.meta) >= 0) {
    n += 1
  }
  return n
}

/**
 * Answers every datagram waiting. A `spoof.test` A query is first answered
 * three ways the client must drop: the genuine reply from another port, then
 * from the server with another ID, then with another question.
 */
const serverUdp = (s: Server): void => {
  let n: i32 = udpRecvFrom(s.udp, s.buf, 0, toI32(s.buf.length), s.from, s.meta)
  while (n >= 0) {
    s.udpQueries += 1
    s.ids.push(toI32(s.buf[0]) * 256 + toI32(s.buf[1]))
    s.ports.push(toI32(s.from[16]) * 256 + toI32(s.from[17]))
    const reply: u8[] = replyTo(s.buf, n, false)
    const len: i32 = toI32(reply.length)
    const qtype: i32[] = [0, 0]
    if (questionOf(s.buf, n, qtype) === "spoof.test" && qtype[0] === DNS_TYPE_A) {
      const forged: u8[] = copy(reply, 0, len)
      forged[len - 1] = toU8(6)
      udpSendTo(s.spoofer, forged, 0, len, s.from, 0, 0)
      const wrongId: u8[] = copy(forged, 0, len)
      wrongId[1] = toU8(toI32(wrongId[1]) ^ 1)
      udpSendTo(s.udp, wrongId, 0, len, s.from, 0, 0)
      const wrongQuestion: u8[] = copy(forged, 0, len)
      setU16BE(wrongQuestion, qtype[1] - 4, toU16(DNS_TYPE_AAAA))
      udpSendTo(s.udp, wrongQuestion, 0, len, s.from, 0, 0)
    }
    udpSendTo(s.udp, reply, 0, len, s.from, 0, 0)
    n = udpRecvFrom(s.udp, s.buf, 0, toI32(s.buf.length), s.from, s.meta)
  }
}

/** Takes every waiting connection into a free slot, watched under its token. */
const serverAccept = (s: Server, loop: i32): void => {
  let fd: i32 = tcpAccept(s.listener, s.from)
  while (fd >= 0) {
    let slot: i32 = 0
    while (slot < CONNS && s.conns[slot] >= 0) {
      slot += 1
    }
    if (slot === CONNS) {
      netClose(fd)
    } else {
      s.conns[slot] = fd
      s.connHave[slot] = 0
      pollAdd(loop, fd, 1, CONN_TOKEN + slot)
    }
    fd = tcpAccept(s.listener, s.from)
  }
}

/** Reads connection `slot`; a whole length-prefixed query is answered the same way. */
const serverStream = (s: Server, slot: i32): void => {
  const fd: i32 = s.conns[slot]
  if (fd < 0) {
    return
  }
  const buf: u8[] = s.connBufs[slot]
  while (true) {
    const n: i32 = netRead(fd, buf, s.connHave[slot], CONN_BUF - s.connHave[slot])
    if (n === WOULD_BLOCK) {
      return
    }
    if (n <= 0) {
      netClose(fd)
      s.conns[slot] = -1
      return
    }
    s.connHave[slot] += n
    const have: i32 = s.connHave[slot]
    if (have >= 2) {
      const want: i32 = toI32(buf[0]) * 256 + toI32(buf[1])
      if (have >= 2 + want) {
        s.tcpQueries += 1
        const reply: u8[] = replyTo(copy(buf, 2, want), want, true)
        const framed: u8[] = cat([toU8(0), toU8(0)], reply)
        setU16BE(framed, 0, toU16(toI32(reply.length)))
        let sent: i32 = 0
        while (sent < framed.length) {
          const w: i32 = netWrite(fd, framed, sent, toI32(framed.length) - sent)
          if (w < 0 && w !== WOULD_BLOCK) {
            break
          }
          if (w > 0) {
            sent += w
          }
        }
        s.connHave[slot] = 0
      }
    }
  }
}

/** The answer a lookup ended with. */
class Answer {
  status: i32 = 0
  out: u8[]
  ttls: i32[]
  millis: i32 = 0

  constructor() {
    this.out = new Array<u8>(32 * DNS_ADDRESS_BYTES)
    this.ttls = new Array<i32>(32)
  }
}

/** Each address as hex and its TTL after a slash, joined by spaces. */
const listed = (a: Answer): string => {
  let s: string = ""
  let i: i32 = 0
  while (i < a.status) {
    if (i > 0) {
      s = s + " "
    }
    s = s + toHex(a.out, i * DNS_ADDRESS_BYTES, DNS_ADDRESS_BYTES) + "/" + `${a.ttls[i]}`
    i += 1
  }
  return s
}

/**
 * Drives `loop` for the server and `c` until `lookup` ends or five seconds
 * pass: the program's own loop, the client given only its tokens' pairs.
 */
const run = (s: Server, c: DnsClient, loop: i32, lookup: i32, begun: i64): Answer => {
  const a: Answer = new Answer()
  const ready: i32[] = new Array<i32>(32)
  const end: i64 = begun + toI64(5000) * 1000000
  a.status = c.result(lookup, a.out, a.ttls)
  while (a.status === DNS_RESOLVE_PENDING && monotonicNanos() < end) {
    const count: i32 = pollWait(loop, ready, c.timeoutMs(monotonicNanos(), 100))
    const now: i64 = monotonicNanos()
    let k: i32 = 0
    while (k < count) {
      const token: i32 = ready[2 * k]
      if (c.owns(token)) {
        c.ready(token, ready[2 * k + 1], now)
      } else if (token === UDP_TOKEN) {
        serverUdp(s)
      } else if (token === LISTEN_TOKEN) {
        serverAccept(s, loop)
      } else if (token >= CONN_TOKEN && token < CONN_TOKEN + CONNS) {
        serverStream(s, token - CONN_TOKEN)
      }
      k += 1
    }
    c.tick(monotonicNanos())
    a.status = c.result(lookup, a.out, a.ttls)
  }
  a.millis = toI32((monotonicNanos() - begun) / 1000000)
  return a
}

/** A config from `text` whose nameservers' ports are `ports`, in order. */
const config = (text: string, ports: i32[]): DnsConfig => {
  const c: DnsConfig = new DnsConfig()
  const b: u8[] = ascii(text)
  dnsParseResolvConf(b, 0, toI32(b.length), c)
  let i: i32 = 0
  while (i < ports.length) {
    setU16BE(c.servers, i * DNS_ADDRESS_BYTES + 16, toU16(ports[i]))
    i += 1
  }
  return c
}

/** How many different values `xs` holds. */
const distinct = (xs: i32[]): i32 => {
  let n: i32 = 0
  let i: i32 = 0
  while (i < xs.length) {
    let j: i32 = 0
    while (j < i && xs[j] !== xs[i]) {
      j += 1
    }
    if (j === i) {
      n += 1
    }
    i += 1
  }
  return n
}

/** ::ffff:127.0.0.1, the form every loopback address below takes, without its port. */
const LOOPBACK4: string = "00000000000000000000ffff7f000001"
const WWW_A: string = "00000000000000000000ffffc0000201"
const WWW_AAAA: string = "20010db8000000000000000000000001"

export const main = (): number => {
  const t = new Suite("dns")
  const loop: i32 = pollCreate()
  const s: Server = new Server()
  if (loop < 0 || serverOpen(s, loop) !== 0) {
    t.fail("setup: the loopback server is listening", `${loop} ${s.udp} ${s.listener}`)
    return t.done()
  }
  const one: string = "nameserver 127.0.0.1\nsearch zone.test\noptions timeout:1 attempts:1\n"
  const live: DnsConfig = config(one, [s.port])
  const c: DnsClient = new DnsClient(new DnsResolver(live, null, 4), loop, 100)

  // A and AAAA over UDP, A first, each with its own TTL and the port asked for.
  const www: Answer = run(s, c, loop, c.start("www.test", 443, monotonicNanos()), monotonicNanos())
  t.eqI32("udp: www.test has two addresses", www.status, 2)
  t.eqStr("udp: A then AAAA, with their TTLs", listed(www), `${WWW_A}01bb/300 ${WWW_AAAA}01bb/600`)
  t.eqI32("udp: two queries over UDP", s.udpQueries, 2)

  // An absolute name skips the search list; NXDOMAIN with nothing left is NOT_FOUND.
  const dotted: Answer = run(s, c, loop, c.start("www.test.", 80, monotonicNanos()), monotonicNanos())
  t.eqI32("absolute: www.test. resolves", dotted.status, 2)
  const missing: Answer = run(s, c, loop, c.start("nowhere.test", 80, monotonicNanos()), monotonicNanos())
  t.eqI32("nxdomain: nowhere.test is NOT_FOUND", missing.status, DNS_RESOLVE_NOT_FOUND)

  // TC over UDP: both queries are asked again over TCP, and the TCP answer stands.
  const udpBefore: i32 = s.udpQueries
  const big: Answer = run(s, c, loop, c.start("big.test", 80, monotonicNanos()), monotonicNanos())
  t.eqStr(
    "tc: big.test answered over TCP",
    listed(big),
    "00000000000000000000ffffc00002070050/60 20010db8000000000000000000000007" + "0050/120"
  )
  t.eqI32("tc: two truncated datagrams", s.udpQueries - udpBefore, 2)
  t.eqI32("tc: both retried over TCP", s.tcpQueries, 2)
  t.eqI32("tc: tcpRetries counts them", c.resolver.tcpRetries, 2)

  // A CNAME in the reply is followed to the target's records.
  const alias: Answer = run(s, c, loop, c.start("alias.test", 80, monotonicNanos()), monotonicNanos())
  t.eqI32("cname: alias.test reaches www.test's two addresses", alias.status, 2)
  t.contains("cname: the A record is www.test's", listed(alias), WWW_A)

  // `host` has fewer dots than ndots, so search zone.test answers first; its AAAA is NODATA.
  const host: Answer = run(s, c, loop, c.start("host", 80, monotonicNanos()), monotonicNanos())
  t.eqStr("search: host is host.zone.test", listed(host), "00000000000000000000ffffc00002030050/100")

  // Two lookups at once through the one client.
  const both0: i32 = c.start("www.test", 80, monotonicNanos())
  const both1: i32 = c.start("big.test", 80, monotonicNanos())
  const first: Answer = run(s, c, loop, both0, monotonicNanos())
  const second: Answer = run(s, c, loop, both1, monotonicNanos())
  t.eqI32("concurrent: www.test", first.status, 2)
  t.eqI32("concurrent: big.test", second.status, 2)

  // Forged replies, from another port, with another ID and with another question,
  // are dropped, and the genuine reply behind them still completes the lookup.
  const spoof: Answer = run(s, c, loop, c.start("spoof.test", 80, monotonicNanos()), monotonicNanos())
  t.eqStr("spoof: the genuine address stands", listed(spoof), "00000000000000000000ffffc00002040050/100")
  t.eqI32("spoof: another port is droppedSource", c.resolver.droppedSource, 1)
  t.eqI32("spoof: another ID is droppedId", c.resolver.droppedId, 1)
  t.eqI32("spoof: another question is droppedQuestion", c.resolver.droppedQuestion, 1)

  // Every UDP query went from a fresh socket with a fresh ID.
  t.ok("vary: IDs differ between queries", distinct(s.ids) > s.ids.length / 2)
  t.ok("vary: source ports differ between queries", distinct(s.ports) > s.ports.length / 2)
  t.eqI32("client: no socket failed", c.socketFailures, 0)

  // A dead server first: each query waits its one-second timeout there, then the live one answers.
  const two: string = "nameserver 127.0.0.1\nnameserver 127.0.0.1\noptions timeout:1 attempts:1\n"
  const deadFirst: DnsClient = new DnsClient(new DnsResolver(config(two, [s.deadPort, s.port]), null, 1), loop, 200)
  const failover: Answer = run(s, deadFirst, loop, deadFirst.start("www.test", 80, monotonicNanos()), monotonicNanos())
  t.eqI32("dead server: the next one answers", failover.status, 2)
  t.eqI32("dead server: both queries timed out there", deadFirst.resolver.timeouts, 2)
  t.ok("dead server: after its timeout", failover.millis >= 1000)
  t.eqI32("dead server: asked once per type", deadQueries(s), 2)

  // Only the dead server, two attempts: each type asks it twice, then NO_ANSWER.
  const deadOnly: string = "nameserver 127.0.0.1\noptions timeout:1 attempts:2\n"
  const silent: DnsClient = new DnsClient(new DnsResolver(config(deadOnly, [s.deadPort]), null, 1), loop, 300)
  const gone: Answer = run(s, silent, loop, silent.start("www.test", 80, monotonicNanos()), monotonicNanos())
  t.eqI32("attempts: NO_ANSWER after every try", gone.status, DNS_RESOLVE_NO_ANSWER)
  t.eqI32("attempts: two tries per type", deadQueries(s), 4)
  t.ok("attempts: two timeouts long", gone.millis >= 2000)

  // The blocking calls: a hosts-file name and localhost with no packet, and a timeout.
  const queriesBefore: i32 = s.udpQueries + s.tcpQueries
  const hosts: DnsHosts = new DnsHosts()
  const hostsText: u8[] = ascii("192.0.2.9 printer.lan\n")
  dnsParseHosts(hostsText, 0, toI32(hostsText.length), hosts)
  const out: u8[] = new Array<u8>(32 * DNS_ADDRESS_BYTES)
  const ttls: i32[] = new Array<i32>(32)
  t.eqI32("hosts: printer.lan from the hosts file", dnsLookupWith(live, hosts, "printer.lan", 1000, 80, out, ttls), 1)
  t.eqStr("hosts: its address", toHex(out, 0, DNS_ADDRESS_BYTES), "00000000000000000000ffffc00002090050")
  t.eqI32("localhost: resolveHost answers two", resolveHost("localhost", 1000, 80, out, ttls), 2)
  t.eqStr("localhost: 127.0.0.1 first", toHex(out, 0, DNS_ADDRESS_BYTES), `${LOOPBACK4}0050`)
  t.eqStr("localhost: then ::1", toHex(out, DNS_ADDRESS_BYTES, DNS_ADDRESS_BYTES), "00000000000000000000000000000001" + "0050")
  t.eqI32("no packet: the server saw nothing", s.udpQueries + s.tcpQueries, queriesBefore)
  const silentConfig: DnsConfig = config(deadOnly, [s.deadPort])
  t.eqI32("timeout: dnsLookupWith gives up", dnsLookupWith(silentConfig, null, "www.test", 300, 80, out, ttls), DNS_RESOLVE_TIMEOUT)
  netClose(loop)
  return t.done()
}
