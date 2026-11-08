// WP49 stage 5: `await fetch(url)` looks a name up without blocking the
// process. A DNS server on loopback, a task in this program, takes the query
// for `slow.test` and holds its answer until another task has fetched from
// the HTTP server by its address. Were the lookup to block the process, that
// task could never run and the answer would never come; so "literal" prints
// before "named", shown by order, not by a clock. The fetch reaches the
// server through `HttpOptions.dns`, a resolv.conf naming it. The same answer
// under the default outbound policy (public addresses only) is refused, and
// a server that never answers ends the lookup at `connectTimeoutMs`.
import { readable, sleep, spawn } from "nish:async"
import { netClose, netLocalPort, tcpListen, udpBind, udpRecvFrom, udpSendTo } from "nish:net"
import { setU16BE } from "nish/bytes"
import { DnsConfig, dnsParseResolvConf } from "nish/net/dns-config"
import { DNS_ADDRESS_BYTES } from "nish/net/dns-message"
import { HTTP_E_BLOCKED, HTTP_E_CONNECT_TIMEOUT, HttpOptions, RequestInit, fetch, httpErrorName } from "nish/net/fetch"
import { OutboundPolicy } from "nish/net/outbound"
import { serve } from "../net_fetch_async/server"

/** NOERROR, RD and RA. */
const OK: i32 = 0x8180
const TYPE_A: i32 = 1

/**
 * The gate the spawned tasks share, module storage as a task takes no object
 * argument: `[ASKED]` counts the queries the DNS task has seen, `[OPEN]` is 1
 * once it may answer them.
 */
const gate = new Array<i32>(2)
const ASKED: i32 = 0
const OPEN: i32 = 1

/** A resolver config whose one server is `127.0.0.1:port`, one try of one second. */
function configFor(port: i32): DnsConfig {
  const text: string = "nameserver 127.0.0.1\noptions timeout:1 attempts:1\n"
  const b: u8[] = new Array<u8>(text.length)
  for (let i: i32 = 0; i < text.length; i += 1) {
    b[i] = toU8(text.charCodeAt(i))
  }
  const c: DnsConfig = new DnsConfig()
  dnsParseResolvConf(b, 0, toI32(b.length), c)
  setU16BE(c.servers, 16, toU16(port))
  return c
}

/**
 * The answer to the query `q[0, len)`: its question, then `127.0.0.1` for an
 * A query and nothing for any other type. Any EDNS record is left out.
 */
function dnsAnswer(q: u8[], len: i32): u8[] {
  let at: i32 = 12
  while (at < len && q[at] !== toU8(0)) {
    at += toI32(q[at]) + 1
  }
  const end: i32 = at + 5
  const qtype: i32 = (toI32(q[at + 1]) << 8) | toI32(q[at + 2])
  const extra: i32 = qtype === TYPE_A ? 16 : 0
  const out: u8[] = new Array<u8>(end + extra)
  for (let i: i32 = 0; i < end; i += 1) {
    out[i] = q[i]
  }
  setU16BE(out, 2, toU16(OK))
  setU16BE(out, 6, toU16(qtype === TYPE_A ? 1 : 0))
  setU16BE(out, 8, toU16(0))
  setU16BE(out, 10, toU16(0))
  if (qtype === TYPE_A) {
    const rr: i32[] = [0xc0, 0x0c, 0, 1, 0, 1, 0, 0, 0, 60, 0, 4, 127, 0, 0, 1]
    for (let i: i32 = 0; i < 16; i += 1) {
      out[end + i] = toU8(rr[i])
    }
  }
  return out
}

/** Answers `count` queries on `udp`, none of them before the gate opens. */
async function dnsServer(udp: i32, count: i32): Promise<void> {
  const buf: u8[] = new Array<u8>(1500)
  const from: u8[] = new Array<u8>(DNS_ADDRESS_BYTES)
  const meta: i32[] = [0, 0]
  let answered: i32 = 0
  while (answered < count) {
    const n: i32 = udpRecvFrom(udp, buf, 0, 1500, from, meta)
    if (n === -11) {
      const ok = await readable(udp)
      if (!ok) {
        break
      }
      continue
    }
    if (n < 12) {
      break
    }
    gate[ASKED] += 1
    if (gate[ASKED] === 1) {
      console.log("dns: asked for slow.test; the answer waits for the other task")
    }
    while (gate[OPEN] === 0) {
      await sleep(5)
    }
    const reply: u8[] = dnsAnswer(buf, n)
    udpSendTo(udp, reply, 0, toI32(reply.length), from, 0, 0)
    answered += 1
  }
  netClose(udp)
}

/** Once the DNS server holds a query, fetches `/literal` from `port` by address and then lets it answer. */
async function beside(port: i32): Promise<void> {
  while (gate[ASKED] === 0) {
    await sleep(5)
  }
  const res = await fetch(`http://127.0.0.1:${port}/literal`)
  console.log(res.isOk() ? `literal: ${res.value.status} ${res.value.text()}` : `literal: ${res.error.text}`)
  gate[OPEN] = 1
}

function initFor(dns: DnsConfig, outbound: OutboundPolicy | null, connectMs: i32): RequestInit {
  const init: RequestInit = new RequestInit()
  const options: HttpOptions = init.options
  options.useEnvProxy = false
  options.dns = dns
  options.outbound = outbound
  options.connectTimeoutMs = connectMs
  return init
}

/** The three lookups through the DNS servers on `dnsPort` and `deadPort`, in turn. */
async function lookups(port: i32, dnsPort: i32, deadPort: i32): Promise<i32> {
  const config: DnsConfig = configFor(dnsPort)
  const named = await fetch(`http://slow.test:${port}/named`, initFor(config, null, 5000))
  console.log(named.isOk() ? `named: ${named.value.status} ${named.value.text()}` : `named: ${named.error.text}`)

  const guarded = await fetch(`http://slow.test:${port}/guarded`, initFor(config, new OutboundPolicy(), 5000))
  console.log(`under the default outbound policy: ${guarded.isErr() ? httpErrorName(guarded.error.code) : "answered"}`)
  if (guarded.isErr() && guarded.error.code !== HTTP_E_BLOCKED) {
    console.log(`  ${guarded.error.text}`)
  }

  const silent = await fetch(`http://slow.test:${port}/silent`, initFor(configFor(deadPort), null, 300))
  console.log(`a server that never answers: ${silent.isErr() ? silent.error.text : "answered"}`)
  if (silent.isErr() && silent.error.code !== HTTP_E_CONNECT_TIMEOUT) {
    console.log(`  code ${silent.error.code}`)
  }
  return 0
}

export async function main(): Promise<i32> {
  const listen: i32 = tcpListen("127.0.0.1", 0, 16)
  const udp: i32 = udpBind("127.0.0.1", 0, 0)
  const dead: i32 = udpBind("127.0.0.1", 0, 0)
  if (listen < 0 || udp < 0 || dead < 0) {
    console.log("FAIL  the servers could not be opened")
    return 1
  }
  const port: i32 = netLocalPort(listen)
  spawn(serve(listen, 2, 0))
  spawn(dnsServer(udp, 4))
  spawn(beside(port))
  const done: i32 = await lookups(port, netLocalPort(udp), netLocalPort(dead))
  netClose(dead)
  console.log(`dns: ${gate[ASKED]} queries asked`)
  return done
}
