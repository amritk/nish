// `nish/net/dns-resolver`: the sans-IO core driven with scripted packets and a
// scripted clock, so every send, drop, bound and error path is pinned without
// a socket. Replies are built from the query the resolver wrote (its header
// and question copied, flags and answers set), the way a server answers.
// Every line names its case, and the run prints the same lines natively and
// under `--profile wasi`.
import {
  DNS_CLOSE,
  DNS_OUTGOING_MAX_BYTES,
  DNS_RESOLVE_BUSY,
  DNS_RESOLVE_CNAME,
  DNS_RESOLVE_MAX_ADDRESSES,
  DNS_RESOLVE_NO_ANSWER,
  DNS_RESOLVE_NOT_FOUND,
  DNS_RESOLVE_PENDING,
  DNS_RESOLVER_MAX_CNAME_HOPS,
  DNS_SEND_TCP,
  DNS_SEND_UDP,
  DNS_TCP_MAX_REPLY,
  DnsResolver,
} from "nish/net/dns-resolver"
import { DnsConfig, DnsHosts, dnsParseHosts, dnsParseResolvConf } from "nish/net/dns-config"
import { DNS_ADDRESS_BYTES, DNS_ERR_LABEL_LONG, DNS_TYPE_A, DNS_TYPE_AAAA } from "nish/net/dns-message"
import { setU16BE } from "nish/bytes"
import { Suite } from "nish/testing"

const HEX: string = "0123456789abcdef"

/** NOERROR, RD and RA; NXDOMAIN; SERVFAIL; and NOERROR with TC set. */
const OK: i32 = 0x8180
const NXDOMAIN: i32 = 0x8183
const SERVFAIL: i32 = 0x8182
const TRUNCATED: i32 = 0x8380

/** The first server of every config below, 192.0.2.53 port 53, and the second, 192.0.2.54. */
const SERVER_1: string = "00000000000000000000ffffc00002350035"
const SERVER_2: string = "00000000000000000000ffffc00002360035"

/** The bytes of an ASCII string. */
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

const config = (text: string): DnsConfig => {
  const c: DnsConfig = new DnsConfig()
  const b: u8[] = ascii(text)
  dnsParseResolvConf(b, 0, toI32(b.length), c)
  return c
}

const hostsOf = (text: string): DnsHosts => {
  const h: DnsHosts = new DnsHosts()
  const b: u8[] = ascii(text)
  dnsParseHosts(b, 0, toI32(b.length), h)
  return h
}

/** One thing the resolver asked the driver to do, copied out of `nextOutgoing`. */
class Sent {
  q: i32 = -1
  kind: i32 = 0
  len: i32 = 0
  bytes: u8[]
  to: u8[]

  constructor() {
    this.bytes = new Array<u8>(DNS_OUTGOING_MAX_BYTES)
    this.to = new Array<u8>(DNS_ADDRESS_BYTES)
  }
}

/** The resolver's next outgoing, drawn with `id`. */
const take = (r: DnsResolver, id: i32): Sent => {
  const s: Sent = new Sent()
  const meta: i32[] = new Array<i32>(2)
  meta[0] = 0
  meta[1] = 0
  s.q = r.nextOutgoing(s.bytes, s.to, meta, id)
  s.kind = meta[0]
  s.len = meta[1]
  return s
}

/** The resolver's next send, drawn with `id`, past any closes it owes first. */
const takeSend = (r: DnsResolver, id: i32): Sent => {
  let s: Sent = take(r, id)
  while (s.q >= 0 && s.kind === DNS_CLOSE) {
    s = take(r, id)
  }
  return s
}

/** Where a send's DNS message starts: after the length on TCP. */
const messageAt = (s: Sent): i32 => (s.kind === DNS_SEND_TCP ? 2 : 0)

/** The ID a send carries. */
const idOf = (s: Sent): i32 => toI32(s.bytes[messageAt(s)]) * 256 + toI32(s.bytes[messageAt(s) + 1])

/** The question name a send asks, dotted, and its type after a space. */
const asks = (s: Sent): string => {
  let at: i32 = messageAt(s) + 12
  let name: string = ""
  while (at < s.len && s.bytes[at] !== toU8(0)) {
    const n: i32 = toI32(s.bytes[at])
    if (name.length > 0) {
      name = name + "."
    }
    let k: i32 = 0
    while (k < n) {
      name = name + String.fromCharCode(toI32(s.bytes[at + 1 + k]))
      k += 1
    }
    at += n + 1
  }
  const qtype: i32 = toI32(s.bytes[at + 1]) * 256 + toI32(s.bytes[at + 2])
  return name + (qtype === DNS_TYPE_A ? " A" : qtype === DNS_TYPE_AAAA ? " AAAA" : " ?")
}

/** One answer record: `owner`, `rtype`, class IN, `ttl`, `rdata`. */
const record = (owner: string, rtype: i32, ttl: i32, rdata: u8[]): u8[] => {
  const head: u8[] = wire(owner)
  const fixed: u8[] = new Array<u8>(10)
  setU16BE(fixed, 0, toU16(rtype))
  setU16BE(fixed, 2, toU16(1))
  setU16BE(fixed, 4, toU16(ttl >> 16))
  setU16BE(fixed, 6, toU16(ttl & 0xffff))
  setU16BE(fixed, 8, toU16(toI32(rdata.length)))
  return cat(cat(head, fixed), rdata)
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
  let i: i32 = 0
  while (i < 16) {
    out[i] = toU8(0)
    i += 1
  }
  out[0] = toU8(0x20)
  out[1] = toU8(0x01)
  out[2] = toU8(0x0d)
  out[3] = toU8(0xb8)
  out[15] = toU8(last)
  return out
}

/** A server's reply to `s`: its header and question, `flags`, and `ancount` records. */
const reply = (s: Sent, flags: i32, ancount: i32, records: u8[]): u8[] => {
  const at: i32 = messageAt(s)
  const n: i32 = s.len - at
  const out: u8[] = new Array<u8>(n)
  let i: i32 = 0
  while (i < n) {
    out[i] = s.bytes[at + i]
    i += 1
  }
  setU16BE(out, 2, toU16(flags))
  setU16BE(out, 6, toU16(ancount))
  return cat(out, records)
}

/** `msg` with its two-byte TCP length in front. */
const framed = (msg: u8[]): u8[] => {
  const head: u8[] = new Array<u8>(2)
  setU16BE(head, 0, toU16(toI32(msg.length)))
  return cat(head, msg)
}

/** Feeds `msg` to `s`'s query as one datagram from the server it was sent to. */
const answer = (r: DnsResolver, s: Sent, msg: u8[], now: i64): void => {
  r.receive(s.q, msg, toI32(msg.length), s.to, now)
}

/** A lookup's finished answer, read with `result`. */
class Answer {
  count: i32 = 0
  out: u8[]
  ttls: i32[]

  constructor() {
    this.out = new Array<u8>(DNS_RESOLVE_MAX_ADDRESSES * DNS_ADDRESS_BYTES)
    this.ttls = new Array<i32>(DNS_RESOLVE_MAX_ADDRESSES)
  }
}

const resultOf = (r: DnsResolver, lookup: i32): Answer => {
  const a: Answer = new Answer()
  a.count = r.result(lookup, a.out, a.ttls)
  return a
}

/** An answer's addresses as hex, each with its TTL after a slash, joined by spaces. */
const listed = (a: Answer): string => {
  let s: string = ""
  let i: i32 = 0
  while (i < a.count) {
    s = s + (i > 0 ? " " : "") + toHex(a.out, i * DNS_ADDRESS_BYTES, DNS_ADDRESS_BYTES) + "/" + `${a.ttls[i]}`
    i += 1
  }
  return s
}

/** 192.0.2.`d` and 2001:db8::`d` on port 80, as `listed` writes them without the TTL. */
const A80 = (d: i32): string => "00000000000000000000ffffc00002" + toHex(v4(0, 0, 0, d), 3, 1) + "0050"
const AAAA80 = (d: i32): string => "20010db8000000000000000000000000".substring(0, 30) + toHex(v4(0, 0, 0, d), 3, 1) + "0050"

/** Every outgoing the resolver owes, drawn with IDs from `id` up, as "q:kind" joined by spaces. */
const drain = (r: DnsResolver, id: i32): string => {
  let s: string = ""
  let next: i32 = id
  let o: Sent = take(r, next)
  while (o.q >= 0) {
    s = s + (s.length > 0 ? " " : "") + `${o.q}:${o.kind}`
    next += 1
    o = take(r, next)
  }
  return s
}

const ONE: string = "nameserver 192.0.2.53\n"
const TWO: string = "nameserver 192.0.2.53\nnameserver 192.0.2.54\n"

export const main = (): number => {
  const t = new Suite("dns-resolver")
  const second: i64 = toI64(1000000000)
  const zero: i64 = toI64(0)

  // --- answered at once, with no packet ----------------------------------------
  {
    const r: DnsResolver = new DnsResolver(config(ONE), null, 4)
    const l: i32 = r.start("localhost", 1000, zero)
    const a: Answer = resultOf(r, l)
    t.eqStr(
      "localhost: 127.0.0.1 then ::1, on the port asked, with no packet",
      listed(a),
      "00000000000000000000ffff7f00000103e8/0 00000000000000000000000000000001" + "03e8/0"
    )
    t.eqI32("localhost: nothing to send", take(r, 1).q, -1)
    const m: i32 = r.start("Foo.LocalHost.", 80, zero)
    t.eqI32("localhost: a name under it, in any case and with the root's dot", resultOf(r, m).count, 2)
    t.eqI32("localhost: still no packet sent", r.sent, 0)
    const x: i32 = r.start("xlocalhost", 80, zero)
    t.eqI32("localhost: xlocalhost is not it, and is asked of the server", resultOf(r, x).count, DNS_RESOLVE_PENDING)
    r.cancel(x)
    const y: i32 = r.start("localhost.example", 80, zero)
    t.eqI32("localhost: localhost.example is not it either", resultOf(r, y).count, DNS_RESOLVE_PENDING)
    r.cancel(y)
    // An empty label before `localhost` is no name: refused, not answered as loopback.
    t.ok("localhost: .localhost is not it", r.start(".localhost", 80, zero) < 0)
    t.ok("localhost: nor x..localhost", r.start("x..localhost", 80, zero) < 0)
  }
  {
    const r: DnsResolver = new DnsResolver(config(ONE), null, 4)
    t.eqStr("literal: 192.0.2.1", listed(resultOf(r, r.start("192.0.2.1", 80, zero))), A80(1) + "/0")
    t.eqStr(
      "literal: ::1",
      listed(resultOf(r, r.start("::1", 443, zero))),
      "00000000000000000000000000000001" + "01bb/0"
    )
    t.eqI32("literal: no packet sent", r.sent, 0)
  }
  {
    const hosts: DnsHosts = hostsOf("192.0.2.5 db.internal db\n2001:db8::5 db.internal\n")
    const r: DnsResolver = new DnsResolver(config(ONE), hosts, 4)
    t.eqStr(
      "hosts: both of the name's entries, A first, TTL 0",
      listed(resultOf(r, r.start("DB.internal", 80, zero))),
      A80(5) + "/0 " + AAAA80(5) + "/0"
    )
    t.eqStr("hosts: an alias", listed(resultOf(r, r.start("db", 80, zero))), A80(5) + "/0")
    t.eqI32("hosts: no packet sent", r.sent, 0)
    t.eqI32("hosts: every answered slot is free once read", r.active(), 0)
  }
  {
    const r: DnsResolver = new DnsResolver(config(ONE), null, 4)
    let long: string = ""
    while (long.length < 64) {
      long = long + "a"
    }
    t.eqI32("name: a label of 64 bytes is refused", r.start(long + ".test", 80, zero), DNS_ERR_LABEL_LONG)
    t.eqI32("name: and holds no slot", r.active(), 0)
  }

  // --- one lookup over UDP ------------------------------------------------------
  {
    const r: DnsResolver = new DnsResolver(config(ONE), null, 4)
    t.eqI32("idle: no deadline", toI32(r.nextDeadlineNanos()), -1)
    const l: i32 = r.start("www.test", 80, zero)
    const a: Sent = take(r, 0x1234)
    const b: Sent = take(r, 0xbeef)
    t.eqStr("udp: A then AAAA", `${a.q}:${a.kind}:${asks(a)} ${b.q}:${b.kind}:${asks(b)}`, "0:1:www.test A 1:1:www.test AAAA")
    t.eqI32("udp: the A query carries the ID it was drawn with", idOf(a), 0x1234)
    t.eqI32("udp: the AAAA query carries its own", idOf(b), 0xbeef)
    t.eqStr("udp: sent to the server", toHex(a.to, 0, DNS_ADDRESS_BYTES), SERVER_1)
    t.eqStr(
      "udp: the query is dnsBuildQuery's, RD set",
      toHex(a.bytes, 0, a.len),
      "123401000001000000000000" + "037777770474657374000001" + "0001"
    )
    t.eqI32("udp: nothing more to send", take(r, 1).q, -1)
    t.ok("udp: the deadline is the timeout from now", r.nextDeadlineNanos() === toI64(5) * second)
    answer(
      r,
      a,
      reply(a, OK, 2, cat(record("www.test", DNS_TYPE_A, 300, v4(192, 0, 2, 1)), record("www.test", DNS_TYPE_A, 60, v4(192, 0, 2, 2)))),
      zero
    )
    t.eqI32("udp: pending until AAAA answers too", resultOf(r, l).count, DNS_RESOLVE_PENDING)
    answer(r, b, reply(b, OK, 1, record("www.test", DNS_TYPE_AAAA, 120, v6(1))), zero)
    t.eqStr("udp: the A query's socket is owed a close, then the AAAA one's", drain(r, 1), "0:3 1:3")
    const done: Answer = resultOf(r, l)
    t.eqStr(
      "udp: A first, every A with the RRset's least TTL, then AAAA",
      listed(done),
      A80(1) + "/60 " + A80(2) + "/60 " + AAAA80(1) + "/120"
    )
    t.eqI32("udp: the slot is free once read", r.active(), 0)
    t.eqI32("udp: two sends", r.sent, 2)
  }

  // --- what a spoofer can send: dropped, and the true reply still answers -------
  {
    const r: DnsResolver = new DnsResolver(config(ONE), null, 4)
    const l: i32 = r.start("www.test", 80, zero)
    const a: Sent = take(r, 7)
    const b: Sent = take(r, 7)
    const good: u8[] = reply(a, OK, 1, record("www.test", DNS_TYPE_A, 30, v4(192, 0, 2, 9)))
    const other: u8[] = new Array<u8>(DNS_ADDRESS_BYTES)
    let i: i32 = 0
    while (i < DNS_ADDRESS_BYTES) {
      other[i] = a.to[i]
      i += 1
    }
    other[17] = toU8(54)
    r.receive(a.q, good, toI32(good.length), other, zero)
    t.eqI32("drop: a reply from the server's address on another port", r.droppedSource, 1)
    other[17] = toU8(53)
    other[15] = toU8(99)
    r.receive(a.q, good, toI32(good.length), other, zero)
    t.eqI32("drop: a reply from another address", r.droppedSource, 2)
    const wrongId: u8[] = reply(a, OK, 1, record("www.test", DNS_TYPE_A, 30, v4(6, 6, 6, 6)))
    wrongId[1] = toU8(8)
    answer(r, a, wrongId, zero)
    t.eqI32("drop: a reply with another ID", r.droppedId, 1)
    // The AAAA query drew the same ID, so its reply differs only in the question.
    answer(r, a, reply(b, OK, 1, record("www.test", DNS_TYPE_AAAA, 30, v6(6))), zero)
    t.eqI32("drop: a reply to another question", r.droppedQuestion, 1)
    answer(r, a, v4(1, 2, 3, 4), zero)
    t.eqI32("drop: a malformed reply", r.droppedMalformed, 1)
    t.eqI32("drop: none of them ended the query", resultOf(r, l).count, DNS_RESOLVE_PENDING)
    answer(r, a, good, zero)
    answer(r, b, reply(b, OK, 0, new Array<u8>(0)), zero)
    t.eqStr("drop: the true reply still answers", listed(resultOf(r, l)), A80(9) + "/30")
    answer(r, a, good, zero)
    t.eqI32("drop: a reply after the query is done is counted, not read", r.droppedMalformed, 2)
  }

  // --- truncated: asked again over TCP ------------------------------------------
  {
    const r: DnsResolver = new DnsResolver(config(ONE), null, 4)
    const l: i32 = r.start("big.test", 80, zero)
    const a: Sent = take(r, 0x1111)
    const b: Sent = take(r, 0x2222)
    answer(r, a, reply(a, TRUNCATED, 0, new Array<u8>(0)), zero)
    t.eqI32("tc: reply.truncated sends the query over TCP", r.tcpRetries, 1)
    const c: Sent = take(r, 0x3333)
    t.eqStr("tc: the A query, over TCP", `${c.q}:${c.kind}:${asks(c)}`, "0:2:big.test A")
    t.eqI32("tc: the stream starts with the message's length", toI32(c.bytes[0]) * 256 + toI32(c.bytes[1]), c.len - 2)
    t.eqI32("tc: with a new ID", idOf(c), 0x3333)
    t.eqStr("tc: to the same server", toHex(c.to, 0, DNS_ADDRESS_BYTES), SERVER_1)
    // A datagram on a query now waiting on TCP is not its reply.
    answer(r, a, reply(a, OK, 0, new Array<u8>(0)), zero)
    t.eqI32("tc: a datagram once the query moved to TCP is dropped", r.droppedMalformed, 1)
    const stream: u8[] = framed(
      reply(c, OK, 2, cat(record("big.test", DNS_TYPE_A, 10, v4(192, 0, 2, 3)), record("big.test", DNS_TYPE_A, 20, v4(192, 0, 2, 4))))
    )
    const one: u8[] = new Array<u8>(1)
    let i: i32 = 0
    while (i < stream.length) {
      one[0] = stream[i]
      r.receiveStream(c.q, one, 1, zero)
      i += 1
    }
    answer(r, b, reply(b, OK, 0, new Array<u8>(0)), zero)
    t.eqStr("tc: a TCP reply read one byte at a time answers", listed(resultOf(r, l)), A80(3) + "/10 " + A80(4) + "/10")
    drain(r, 20)
    // A length under 12 would fail the server and ask the next, were it read.
    const late: u8[] = [toU8(0), toU8(5)]
    const failures: i32 = r.serverFailures
    r.receiveStream(c.q, late, 2, zero)
    t.eqI32("tc: bytes after the query is done are ignored", r.serverFailures, failures)
    t.eqStr("tc: and owe the driver nothing", drain(r, 30), "")
  }
  {
    // Each TCP stream that cannot carry a true reply fails the server, and the
    // query moves on to the next one over UDP.
    const shapes: string[] = ["a length under 12", "a length over DNS_TCP_MAX_REPLY", "a reply still truncated", "a reply with another ID"]
    let k: i32 = 0
    while (k < shapes.length) {
      const r: DnsResolver = new DnsResolver(config(TWO), null, 4)
      r.start("big.test", 80, zero)
      const a: Sent = take(r, 1)
      take(r, 2)
      answer(r, a, reply(a, TRUNCATED, 0, new Array<u8>(0)), zero)
      const c: Sent = take(r, 3)
      let bytes: u8[] = new Array<u8>(2)
      if (k === 0) {
        setU16BE(bytes, 0, toU16(11))
      } else if (k === 1) {
        setU16BE(bytes, 0, toU16(DNS_TCP_MAX_REPLY + 1))
      } else if (k === 2) {
        bytes = framed(reply(c, TRUNCATED, 0, new Array<u8>(0)))
      } else {
        const m: u8[] = reply(c, OK, 1, record("big.test", DNS_TYPE_A, 10, v4(6, 6, 6, 6)))
        m[0] = toU8(0x99)
        bytes = framed(m)
      }
      r.receiveStream(c.q, bytes, toI32(bytes.length), zero)
      const d: Sent = take(r, 4)
      t.eqStr(
        `tc: ${shapes[k]} fails the server, and the next is asked over UDP`,
        `${d.q}:${d.kind}:${r.serverFailures}:` + toHex(d.to, 0, DNS_ADDRESS_BYTES),
        "0:1:1:" + SERVER_2
      )
      k += 1
    }
  }
  {
    const r: DnsResolver = new DnsResolver(config(TWO), null, 4)
    r.start("big.test", 80, zero)
    const a: Sent = take(r, 1)
    take(r, 2)
    answer(r, a, reply(a, TRUNCATED, 0, new Array<u8>(0)), zero)
    const c: Sent = take(r, 3)
    r.fail(c.q, zero)
    const d: Sent = take(r, 4)
    t.eqStr(
      "tc: a refused or broken connection fails the server",
      `${d.q}:${d.kind}:` + toHex(d.to, 0, DNS_ADDRESS_BYTES),
      "0:1:" + SERVER_2
    )
  }
  {
    // A server that drips its TCP reply, or never sends it, holds the query
    // only until the try's deadline, which the TC reply's arrival set.
    const r: DnsResolver = new DnsResolver(config(TWO), null, 4)
    r.start("big.test", 80, zero)
    const a: Sent = take(r, 1)
    take(r, 2)
    answer(r, a, reply(a, TRUNCATED, 0, new Array<u8>(0)), second)
    const c: Sent = take(r, 3)
    const drip: u8[] = framed(reply(c, OK, 1, record("big.test", DNS_TYPE_A, 10, v4(192, 0, 2, 3))))
    r.receiveStream(c.q, drip, 5, second)
    r.tick(toI64(5) * second)
    t.eqI32("tc: a slow TCP reply is not ended before its deadline", r.timeouts, 1)
    r.tick(toI64(6) * second)
    t.eqI32("tc: a slow TCP reply is ended by its deadline", r.timeouts, 2)
    const d: Sent = take(r, 4)
    t.eqStr("tc: and the next server is asked over UDP", `${d.q}:${d.kind}`, "1:1")
    const e: Sent = take(r, 5)
    t.eqStr("tc: the TCP query too", `${e.q}:${e.kind}:` + toHex(e.to, 0, DNS_ADDRESS_BYTES), "0:1:" + SERVER_2)
  }

  // --- CNAME chains -------------------------------------------------------------
  {
    const r: DnsResolver = new DnsResolver(config(ONE), null, 4)
    const l: i32 = r.start("www.test", 80, zero)
    const a: Sent = take(r, 1)
    const b: Sent = take(r, 2)
    answer(
      r,
      a,
      reply(a, OK, 2, cat(record("www.test", 5, 300, wire("web.test")), record("web.test", DNS_TYPE_A, 40, v4(192, 0, 2, 7)))),
      zero
    )
    t.eqI32("cname: a chain the reply answers needs no query", r.cnameQueries, 0)
    answer(r, b, reply(b, OK, 1, record("www.test", 5, 300, wire("web.test"))), zero)
    const c: Sent = takeSend(r, 3)
    t.eqStr("cname: a chain the reply leaves open is asked after", `${c.q}:${asks(c)}:${r.cnameQueries}`, "1:web.test AAAA:1")
    answer(r, c, reply(c, OK, 0, new Array<u8>(0)), zero)
    t.eqStr("cname: an answer through the chain is the lookup's", listed(resultOf(r, l)), A80(7) + "/40")
  }
  {
    const r: DnsResolver = new DnsResolver(config(ONE), null, 4)
    const l: i32 = r.start("www.test", 80, zero)
    const a: Sent = take(r, 1)
    const b: Sent = take(r, 2)
    answer(r, a, reply(a, OK, 1, record("www.test", 5, 300, wire("web.test"))), zero)
    const c: Sent = take(r, 3)
    t.eqStr("cname: the chain's end is asked, the same type", `${c.q}:${c.kind}:${asks(c)}`, "0:1:web.test A")
    t.eqI32("cname: one query followed it", r.cnameQueries, 1)
    answer(r, c, reply(c, OK, 1, record("web.test", DNS_TYPE_A, 40, v4(192, 0, 2, 7))), zero)
    answer(r, b, reply(b, OK, 0, new Array<u8>(0)), zero)
    t.eqStr("cname: its addresses answer the lookup", listed(resultOf(r, l)), A80(7) + "/40")
  }
  {
    const r: DnsResolver = new DnsResolver(config(ONE), null, 4)
    const l: i32 = r.start("www.test", 80, zero)
    const a: Sent = take(r, 1)
    const b: Sent = take(r, 2)
    answer(r, b, reply(b, OK, 0, new Array<u8>(0)), zero)
    answer(r, a, reply(a, OK, 1, record("www.test", 5, 300, wire("loop.test"))), zero)
    const c: Sent = take(r, 3)
    answer(r, c, reply(c, OK, 1, record("loop.test", 5, 300, wire("WWW.test"))), zero)
    t.eqI32("cname: a chain back to the name asked is DNS_RESOLVE_CNAME", resultOf(r, l).count, DNS_RESOLVE_CNAME)
    t.eqI32("cname: and asked it once more, not again", r.sent, 3)
  }
  {
    // h0 → h1 → … : the chain of DNS_RESOLVER_MAX_CNAME_HOPS answers, one more is an error.
    t.eqI32("cname: the bound is 8", DNS_RESOLVER_MAX_CNAME_HOPS, 8)
    let hops: i32 = DNS_RESOLVER_MAX_CNAME_HOPS
    while (hops <= DNS_RESOLVER_MAX_CNAME_HOPS + 1) {
      const r: DnsResolver = new DnsResolver(config(ONE), null, 4)
      const l: i32 = r.start("h0.test", 80, zero)
      let s: Sent = take(r, 1)
      const b: Sent = take(r, 2)
      answer(r, b, reply(b, OK, 0, new Array<u8>(0)), zero)
      let h: i32 = 0
      while (h < hops) {
        answer(r, s, reply(s, OK, 1, record(`h${h}.test`, 5, 300, wire(`h${h + 1}.test`))), zero)
        s = takeSend(r, 10 + h)
        h += 1
      }
      if (s.q >= 0 && s.kind === DNS_SEND_UDP) {
        answer(r, s, reply(s, OK, 1, record(`h${hops}.test`, DNS_TYPE_A, 9, v4(192, 0, 2, 8))), zero)
      }
      const got: i32 = resultOf(r, l).count
      if (hops === DNS_RESOLVER_MAX_CNAME_HOPS) {
        t.eqI32("cname: a chain of DNS_RESOLVER_MAX_CNAME_HOPS queries answers", got, 1)
      } else {
        t.eqI32("cname: one hop more is DNS_RESOLVE_CNAME", got, DNS_RESOLVE_CNAME)
      }
      t.eqI32(`cname: ${hops} hops asked at most DNS_RESOLVER_MAX_CNAME_HOPS queries`, r.cnameQueries, DNS_RESOLVER_MAX_CNAME_HOPS)
      hops += 1
    }
  }

  // --- the search list and ndots ------------------------------------------------
  {
    const c: DnsConfig = config(ONE + "search a.test b.test\noptions ndots:2\n")
    const r: DnsResolver = new DnsResolver(c, null, 4)
    const l: i32 = r.start("x.y", 80, zero)
    let order: string = ""
    let n: i32 = 0
    while (n < 3) {
      const a: Sent = take(r, 1)
      const b: Sent = take(r, 2)
      drain(r, 3)
      order = order + (n > 0 ? ", " : "") + asks(a)
      answer(r, a, reply(a, NXDOMAIN, 0, new Array<u8>(0)), zero)
      answer(r, b, reply(b, NXDOMAIN, 0, new Array<u8>(0)), zero)
      n += 1
    }
    t.eqStr("search: under ndots, each suffix and then the name", order, "x.y.a.test A, x.y.b.test A, x.y A")
    t.eqI32("search: NXDOMAIN for every candidate is DNS_RESOLVE_NOT_FOUND", resultOf(r, l).count, DNS_RESOLVE_NOT_FOUND)
    const m: i32 = r.start("x.y.z", 80, zero)
    const a: Sent = take(r, 1)
    t.eqStr("search: at ndots, the name first", asks(a), "x.y.z A")
    r.cancel(m)
    drain(r, 50)
    const k: i32 = r.start("host.", 80, zero)
    const h1: Sent = takeSend(r, 1)
    const h2: Sent = takeSend(r, 2)
    const h: Sent = h1.q < h2.q ? h1 : h2
    const hb: Sent = h1.q < h2.q ? h2 : h1
    t.eqStr("search: a trailing dot is the name alone", asks(h) + ", " + asks(hb), "host A, host AAAA")
    answer(r, h, reply(h, NXDOMAIN, 0, new Array<u8>(0)), zero)
    answer(r, hb, reply(hb, NXDOMAIN, 0, new Array<u8>(0)), zero)
    t.eqI32("search: and NXDOMAIN ends it", resultOf(r, k).count, DNS_RESOLVE_NOT_FOUND)
    const sent: i32 = r.sent
    drain(r, 60)
    t.eqI32("search: with no other candidate asked", r.sent, sent)
  }
  {
    const r: DnsResolver = new DnsResolver(config(ONE + "search a.test b.test\n"), null, 4)
    const l: i32 = r.start("x", 80, zero)
    const a: Sent = take(r, 1)
    const b: Sent = take(r, 2)
    answer(r, a, reply(a, OK, 0, new Array<u8>(0)), zero)
    answer(r, b, reply(b, OK, 0, new Array<u8>(0)), zero)
    t.eqI32("search: NODATA is DNS_RESOLVE_NOT_FOUND", resultOf(r, l).count, DNS_RESOLVE_NOT_FOUND)
    t.eqI32("search: and stops the search, since the name exists", r.sent, 2)
  }
  {
    // NXDOMAIN names the name, not a type, so one family's NXDOMAIN moves the
    // search on though the other reached no server, whose error stands if no
    // later candidate answers.
    const r: DnsResolver = new DnsResolver(config(ONE + "search a.test b.test\noptions attempts:1\n"), null, 4)
    const l: i32 = r.start("x", 80, zero)
    const a: Sent = take(r, 1)
    const b: Sent = take(r, 2)
    answer(r, a, reply(a, NXDOMAIN, 0, new Array<u8>(0)), zero)
    answer(r, b, reply(b, SERVFAIL, 0, new Array<u8>(0)), zero)
    const c1: Sent = takeSend(r, 3)
    const c2: Sent = takeSend(r, 4)
    const c: Sent = c1.q < c2.q ? c1 : c2
    const d: Sent = c1.q < c2.q ? c2 : c1
    t.eqStr("search: NXDOMAIN and no server for the other family move on", asks(c) + ", " + asks(d), "x.b.test A, x.b.test AAAA")
    answer(r, c, reply(c, OK, 1, record("x.b.test", DNS_TYPE_A, 30, v4(192, 0, 2, 7))), zero)
    answer(r, d, reply(d, OK, 0, new Array<u8>(0)), zero)
    t.eqStr("search: and the name under a later domain resolves", listed(resultOf(r, l)), A80(7) + "/30")
    drain(r, 5)
    const m: i32 = r.start("y", 80, zero)
    let n: i32 = 0
    while (n < 3) {
      const e1: Sent = takeSend(r, 10 + 2 * n)
      const e2: Sent = takeSend(r, 11 + 2 * n)
      answer(r, e1, reply(e1, e1.q % 2 === 0 ? NXDOMAIN : SERVFAIL, 0, new Array<u8>(0)), zero)
      answer(r, e2, reply(e2, e2.q % 2 === 0 ? NXDOMAIN : SERVFAIL, 0, new Array<u8>(0)), zero)
      n += 1
    }
    t.eqI32("search: with no later answer, the unreachable family's error stands", resultOf(r, m).count, DNS_RESOLVE_NO_ANSWER)
    t.eqI32("search: after every candidate was asked", r.sent, 2 + 2 + 6)
  }
  {
    let suffix: string = "s"
    while (suffix.length < 248) {
      suffix = suffix + ".s"
    }
    const r: DnsResolver = new DnsResolver(config(ONE + `search ${suffix} b.test\n`), null, 4)
    r.start("abcdef", 80, zero)
    t.eqStr("search: a suffix that makes the name over 255 bytes is skipped", asks(take(r, 1)), "abcdef.b.test A")
  }

  // --- servers, timeouts and attempts -------------------------------------------
  {
    const r: DnsResolver = new DnsResolver(config(TWO + "options timeout:1 attempts:2\n"), null, 4)
    const l: i32 = r.start("www.test", 80, zero)
    take(r, 1)
    take(r, 2)
    r.tick(second - toI64(1))
    t.eqI32("timeout: nothing before the deadline", r.timeouts, 0)
    r.tick(second)
    t.eqI32("timeout: both queries at the deadline", r.timeouts, 2)
    const a: Sent = take(r, 3)
    const b: Sent = take(r, 4)
    t.eqStr(
      "timeout: a dead server's queries go to the next one",
      `${a.q}:${a.kind}:` + toHex(a.to, 0, DNS_ADDRESS_BYTES) + ` ${b.q}:${b.kind}`,
      "0:1:" + SERVER_2 + " 1:1"
    )
    t.ok("timeout: with a new deadline", r.nextDeadlineNanos() === second + second)
    answer(r, a, reply(a, OK, 1, record("www.test", DNS_TYPE_A, 30, v4(192, 0, 2, 2))), second)
    answer(r, b, reply(b, OK, 0, new Array<u8>(0)), second)
    t.eqStr("timeout: and the next server answers", listed(resultOf(r, l)), A80(2) + "/30")
  }
  {
    const r: DnsResolver = new DnsResolver(config(TWO + "options timeout:1 attempts:2\n"), null, 4)
    const l: i32 = r.start("www.test", 80, zero)
    let order: string = ""
    let s: i32 = 1
    while (s <= 5) {
      const a: Sent = take(r, s)
      take(r, s + 100)
      if (a.q >= 0 && a.kind === DNS_SEND_UDP) {
        order = order + (order.length > 0 ? " " : "") + toHex(a.to, 15, 1)
      }
      r.tick(toI64(s) * second)
      s += 1
    }
    t.eqStr("attempts: each server, then each again, then no more", order, "35 36 35 36")
    t.eqI32("attempts: every try exhausted is DNS_RESOLVE_NO_ANSWER", resultOf(r, l).count, DNS_RESOLVE_NO_ANSWER)
    t.eqI32("attempts: 2 servers × 2 attempts × 2 queries sent", r.sent, 8)
    t.eqI32("attempts: each one timed out", r.timeouts, 8)
    t.ok("attempts: no deadline is left", r.nextDeadlineNanos() === toI64(-1))
  }
  {
    const r: DnsResolver = new DnsResolver(config(TWO), null, 4)
    const l: i32 = r.start("www.test", 80, zero)
    const a: Sent = take(r, 1)
    const b: Sent = take(r, 2)
    answer(r, a, reply(a, SERVFAIL, 0, new Array<u8>(0)), zero)
    const c: Sent = take(r, 3)
    t.eqStr("servfail: the next server is asked at once", `${c.q}:` + toHex(c.to, 0, DNS_ADDRESS_BYTES), "0:" + SERVER_2)
    answer(r, a, reply(a, OK, 1, record("www.test", DNS_TYPE_A, 30, v4(6, 6, 6, 6))), zero)
    t.eqI32("servfail: the first server's late reply is dropped by its source", r.droppedSource, 1)
    answer(r, c, reply(c, OK, 1, record("www.test", DNS_TYPE_A, 30, v4(192, 0, 2, 4))), zero)
    answer(r, b, reply(b, NXDOMAIN, 0, new Array<u8>(0)), zero)
    t.eqStr("servfail: and its answer is the lookup's", listed(resultOf(r, l)), A80(4) + "/30")
  }
  {
    const r: DnsResolver = new DnsResolver(config(ONE + "options attempts:1\n"), null, 4)
    const l: i32 = r.start("www.test", 80, zero)
    const a: Sent = take(r, 1)
    const b: Sent = take(r, 2)
    answer(r, b, reply(b, SERVFAIL, 0, new Array<u8>(0)), zero)
    answer(r, a, reply(a, OK, 1, record("www.test", DNS_TYPE_A, 30, v4(192, 0, 2, 5))), zero)
    t.eqStr("servfail: an A answer stands when AAAA reached no server", listed(resultOf(r, l)), A80(5) + "/30")
    const m: i32 = r.start("www.test", 80, zero)
    const c: Sent = take(r, 3)
    const d: Sent = take(r, 4)
    answer(r, c, reply(c, SERVFAIL, 0, new Array<u8>(0)), zero)
    answer(r, d, reply(d, NXDOMAIN, 0, new Array<u8>(0)), zero)
    t.eqI32("servfail: with no address, no server is DNS_RESOLVE_NO_ANSWER", resultOf(r, m).count, DNS_RESOLVE_NO_ANSWER)
  }

  // --- slots, cancel and closes -------------------------------------------------
  {
    const r: DnsResolver = new DnsResolver(config(ONE), null, 2)
    const l: i32 = r.start("a.test", 80, zero)
    const m: i32 = r.start("b.test", 80, zero)
    t.eqI32("busy: every slot taken is DNS_RESOLVE_BUSY", r.start("c.test", 80, zero), DNS_RESOLVE_BUSY)
    t.eqI32("busy: even for localhost", r.start("localhost", 80, zero), DNS_RESOLVE_BUSY)
    t.eqI32("busy: two active", r.active(), 2)
    t.eqStr("busy: each lookup's two queries are owed sends", drain(r, 1), "0:1 1:1 2:1 3:1")
    r.cancel(l)
    t.eqStr("cancel: its sockets are owed a close", drain(r, 10), "0:3 1:3")
    t.eqI32("cancel: its slot is free", r.start("c.test", 80, zero), l)
    t.eqI32("cancel: two active again", r.active(), 2)
    r.cancel(l)
    r.cancel(m)
    drain(r, 20)
    t.eqI32("cancel: none active", r.active(), 0)
    t.ok("cancel: no deadline left", r.nextDeadlineNanos() === toI64(-1))
  }
  {
    const r: DnsResolver = new DnsResolver(config(ONE), null, 1)
    const l: i32 = r.start("a.test", 80, zero)
    r.cancel(l)
    t.eqStr("cancel: before any send, the sends owed become closes", drain(r, 1), "0:3 1:3")
    t.eqI32("cancel: and nothing was sent", r.sent, 0)
  }
  {
    const r: DnsResolver = new DnsResolver(config("nameserver 2001:db8::53\n"), null, 1)
    r.start("a.test", 80, zero)
    const a: Sent = take(r, 1)
    t.eqStr("ipv6 server: sent to its address", toHex(a.to, 0, DNS_ADDRESS_BYTES), "20010db8000000000000000000000053" + "0035")
    t.eqI32("close: DNS_CLOSE is its own kind", DNS_CLOSE, 3)
  }
  return t.done()
}
