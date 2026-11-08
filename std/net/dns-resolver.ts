/**
 * `nish/net/dns-resolver` — a DNS stub resolver with no I/O of its own: it
 * says which bytes to send to which server, reads the bytes that came back,
 * and answers each lookup's addresses, while the program's own loop owns the
 * sockets and the clock.
 *
 *     import {
 *       DNS_OUTGOING_MAX_BYTES, DNS_RESOLVE_MAX_ADDRESSES, DnsResolver,
 *     } from "nish/net/dns-resolver"
 *     import { DNS_ADDRESS_BYTES } from "nish/net/dns-message"
 *     import { DnsConfig, dnsParseResolvConf } from "nish/net/dns-config"
 *     import { readFileBytesSync } from "nish:fs"
 *     import { monotonicNanos } from "nish:process"
 *
 *     const config = new DnsConfig()
 *     const resolv: u8[] = readFileBytesSync("/etc/resolv.conf") ?? new Array<u8>(0)
 *     dnsParseResolvConf(resolv, 0, toI32(resolv.length), config)
 *     const resolver = new DnsResolver(config, null, 4)
 *     const lookup: i32 = resolver.start("example.com", 443, monotonicNanos())
 *     // lookup < 0: DNS_RESOLVE_BUSY, or the DNS_ERR_* code of a name that is not one
 *     const out: u8[] = new Array<u8>(DNS_OUTGOING_MAX_BYTES)
 *     const to: u8[] = new Array<u8>(DNS_ADDRESS_BYTES)
 *     const meta: i32[] = new Array<i32>(2)
 *     const idBytes: u8[] = new Array<u8>(2)
 *     crypto.getRandomValues(idBytes)                      // a fresh, random 16-bit ID per send
 *     let q: i32 = resolver.nextOutgoing(out, to, meta, (toI32(idBytes[0]) << 8) | toI32(idBytes[1]))
 *     while (q >= 0) {
 *       // meta[0] DNS_SEND_UDP or DNS_SEND_TCP: close q's old socket, send out[0, meta[1]) to `to`
 *       // meta[0] DNS_CLOSE: close q's socket
 *       crypto.getRandomValues(idBytes)
 *       q = resolver.nextOutgoing(out, to, meta, (toI32(idBytes[0]) << 8) | toI32(idBytes[1]))
 *     }
 *     // a datagram for q:  resolver.receive(q, buf, len, from, now)
 *     // TCP bytes for q:   resolver.receiveStream(q, buf, len, now)
 *     // q's socket failed: resolver.fail(q, now)
 *     // now >= resolver.nextDeadlineNanos() (when it is not -1): resolver.tick(now)
 *     const addresses: u8[] = new Array<u8>(DNS_RESOLVE_MAX_ADDRESSES * DNS_ADDRESS_BYTES)
 *     const ttls: i32[] = new Array<i32>(DNS_RESOLVE_MAX_ADDRESSES)
 *     const status: i32 = resolver.result(lookup, addresses, ttls)
 *     // DNS_RESOLVE_PENDING, an address count, or a negative DNS_RESOLVE_* code
 *
 * **It never touches the outside world.** `nish/net/dns` drives it over
 * `nish:net` sockets and adds a blocking `resolveHost`; this module never
 * imports `nish:net`, never reads a clock and never reads a file, so it
 * compiles for `wasm32` and a test drives it with scripted packets. Every time
 * it takes is `nowNanos` on the caller's monotonic clock, in nanoseconds.
 *
 * **A lookup asks A and AAAA at once**, one query each. Each query tries the
 * servers of its `DnsConfig` in turn, `attempts` rounds of `timeout` seconds
 * a try, follows a CNAME the reply leaves unanswered with a query of its own,
 * at most `DNS_RESOLVER_MAX_CNAME_HOPS` of them, and asks again over TCP when
 * a reply comes back truncated. A name goes through the search list as
 * resolv.conf(5) describes. `localhost`, an address literal and a hosts entry
 * answer at once with no packet.
 *
 * **A spoofer can lose a race, never end a lookup.** A reply from any address
 * or port but the server's, or with another ID or question, is dropped and
 * counted, and the query keeps waiting for the true one. The ID of each send
 * is the caller's, given to `nextOutgoing`: `nish/net/dns` draws it from
 * `crypto.getRandomValues`, which a `wasm32` build cannot reach, so this
 * module asks for none and a test can script its IDs.
 *
 * **Every buffer is made in the constructor**; a lookup allocates only the
 * sixteen transient bytes `dnsParseAddress` takes to test a name for an
 * address literal. The resolver keeps the `DnsConfig` and `DnsHosts` it was
 * given, not a copy, and reads them while lookups run: parse new bytes into
 * them between lookups, not during one.
 *
 * **Misuse panics; a server's bytes do not.** A query or lookup number the
 * resolver did not give out, a buffer too short, a port or ID that is not 16
 * bits all panic, while anything a server sends is dropped, counted or fails
 * that server. Every counter stops at the i32 maximum rather than wrapping.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 */
import {
  DNS_ADDRESS_BYTES,
  DNS_ERR_ID,
  DNS_ERR_QUESTION,
  DNS_ERR_RCODE,
  DNS_MAX_ANSWERS,
  DNS_MAX_LABEL_BYTES,
  DNS_MAX_NAME_BYTES,
  DNS_NOERROR,
  DNS_NXDOMAIN,
  DNS_QUERY_MAX_BYTES,
  DNS_TYPE_A,
  DNS_TYPE_AAAA,
  DnsReply,
  dnsBuildQuery,
  dnsParseReply,
} from "nish/net/dns-message"
import { setU16BE } from "nish/bytes"
import { DnsConfig, DnsHosts, dnsHostsFind, dnsParseAddress } from "nish/net/dns-config"

/** `result` for a lookup that has not finished. */
export const DNS_RESOLVE_PENDING: i32 = -40
/**
 * The name has no address: NXDOMAIN for every candidate of the search list,
 * or NODATA for one (which ends the search, as the name exists). Also the
 * answer, with no packet sent, when `start` finds no usable candidate (every
 * suffixed name too long or not a name).
 */
export const DNS_RESOLVE_NOT_FOUND: i32 = -41
/** No server gave an answer: each timed out, failed or was refused, `attempts` rounds over. */
export const DNS_RESOLVE_NO_ANSWER: i32 = -42
/**
 * The CNAME chain loops across queries back to a name already asked, or needs
 * more than `DNS_RESOLVER_MAX_CNAME_HOPS` queries. A loop closed inside one
 * reply is `DNS_RESOLVE_NOT_FOUND`, as that reply names no address.
 */
export const DNS_RESOLVE_CNAME: i32 = -43
/** `start` found every lookup slot in use. */
export const DNS_RESOLVE_BUSY: i32 = -44
/** `resolveHost`'s time ran out before the lookup finished. */
export const DNS_RESOLVE_TIMEOUT: i32 = -45

/** The most queries a CNAME chain may add to one query before it is `DNS_RESOLVE_CNAME`. */
export const DNS_RESOLVER_MAX_CNAME_HOPS: i32 = 8
/**
 * The longest reply read over TCP, in bytes; a length prefix over it, or under
 * the 12-byte header, fails the server.
 */
export const DNS_TCP_MAX_REPLY: i32 = 16384
/** The most addresses one lookup answers: `DNS_MAX_ANSWERS` A and as many AAAA. */
export const DNS_RESOLVE_MAX_ADDRESSES: i32 = 2 * DNS_MAX_ANSWERS
/** The most lookups one resolver holds at once. */
export const DNS_RESOLVER_MAX_LOOKUPS: i32 = 64
/** `nextOutgoing`'s `meta[0]`: send `out` as one datagram to `to` from a new socket. */
export const DNS_SEND_UDP: i32 = 1
/** `nextOutgoing`'s `meta[0]`: connect a new TCP socket to `to` and write `out`. */
export const DNS_SEND_TCP: i32 = 2
/** `nextOutgoing`'s `meta[0]`: close the socket the query held, if any. */
export const DNS_CLOSE: i32 = 3
/** The room `nextOutgoing` needs in `out`, in bytes: a query and TCP's two-byte length. */
export const DNS_OUTGOING_MAX_BYTES: i32 = DNS_QUERY_MAX_BYTES + 2

// A query's state. A lookup's: free, running, or finished with its result held.
const DNS_Q_IDLE: i32 = 0
const DNS_Q_UDP: i32 = 1
const DNS_Q_TCP: i32 = 2
const DNS_Q_DONE: i32 = 3
const DNS_L_FREE: i32 = 0
const DNS_L_RUNNING: i32 = 1
const DNS_L_DONE: i32 = 2

/**
 * A stub resolver of `maxLookups` concurrent lookups over `config`'s servers,
 * answering from `hosts` first when it is given. Query `q` belongs to lookup
 * `q / 2`, and asks A when `q` is even and AAAA when it is odd.
 */
export class DnsResolver {
  /** @internal Used by `dnsResolverNextCandidate`, `dnsResolverCandidate`, `dnsResolverSend` and `dnsResolverServerFailed` in this module. */
  config: DnsConfig
  private hosts: DnsHosts | null
  /**
   * Each query's bytes, from offset 0: the header, the name and the question's type and class.
   * @internal Used by `dnsResolverAsk` in this module.
   */
  queries: u8[][]
  /**
   * Each query's name in wire form, labels and root, as asked; and that name lowercased, the start of its chain.
   * @internal Used by `dnsResolverNextCandidate`, `dnsResolverBegin`, `dnsResolverAsk` and `dnsResolverAnswer` in this module.
   */
  names: u8[][]
  /** @internal Used by `dnsResolverBegin` and `dnsResolverAnswer` in this module. */
  starts: u8[][]
  /** Each query's TCP reply as it arrives, without its two-byte length. */
  private streams: u8[][]
  /**
   * Each query's addresses and their TTLs, once it has its answer.
   * @internal Used by `dnsResolverGather` and `dnsResolverAnswer` in this module.
   */
  answers: u8[][]
  /** @internal Used by `dnsResolverGather` and `dnsResolverAnswer` in this module. */
  answerTtls: i32[][]
  /**
   * Each lookup's name in wire form, without its root byte, as `start` gave it.
   * @internal Used by `dnsResolverCandidate` in this module.
   */
  bases: u8[][]
  /**
   * Each lookup's answer, A first.
   * @internal Used by `dnsResolverGather` in this module.
   */
  lookupAddresses: u8[][]
  /** @internal Used by `dnsResolverGather` in this module. */
  lookupTtls: i32[][]
  /** @internal Used by `dnsResolverAnswer` in this module. */
  reply: DnsReply
  private scratch: u8[]
  /** @internal Used by `dnsResolverAsk` in this module. */
  queryLength: i32[]
  /** @internal Used by `dnsResolverBegin`, `dnsResolverAsk` and `dnsResolverAnswer` in this module. */
  nameLength: i32[]
  /** @internal Used by `dnsResolverStop`, `dnsResolverSend` and `dnsResolverDone` in this module. */
  state: i32[]
  /**
   * The outcome of a finished query: its address count, or `DNS_RESOLVE_*`.
   * @internal Used by `dnsResolverDone` in this module.
   */
  outcome: i32[]
  /**
   * The action `nextOutgoing` owes the driver for a query: 0 or a `DNS_SEND_*`/`DNS_CLOSE`.
   * @internal Used by `dnsResolverStop`, `dnsResolverSend` and `dnsResolverDone` in this module.
   */
  pending: i32[]
  /** @internal Used by `dnsResolverAsk` and `dnsResolverServerFailed` in this module. */
  server: i32[]
  /** @internal Used by `dnsResolverAsk` and `dnsResolverServerFailed` in this module. */
  round: i32[]
  /** @internal Used by `dnsResolverBegin` and `dnsResolverAnswer` in this module. */
  hops: i32[]
  /** @internal Used by `dnsResolverSend` in this module. */
  deadline: i64[]
  /**
   * Bytes of the TCP reply read so far, its two-byte length included, and that length once read.
   * @internal Used by `dnsResolverSend` in this module.
   */
  streamHave: i32[]
  /** @internal Used by `dnsResolverSend` in this module. */
  streamWant: i32[]
  /** @internal Used by `dnsResolverCandidate` in this module. */
  baseLength: i32[]
  /**
   * Whether a finished query's name was NXDOMAIN, which moves the search on, rather than NODATA, which ends it.
   * @internal Used by `dnsResolverAsk`, `dnsResolverAnswer` and `dnsResolverDone` in this module.
   */
  nxdomain: boolean[]
  /**
   * Whether a lookup's name ended in a dot, so no search suffix applies.
   * @internal Used by `dnsResolverNextCandidate` in this module.
   */
  absolute: boolean[]
  /**
   * The candidate a lookup is asking, by `dnsResolverCandidate`'s order, and how many it has.
   * @internal Used by `dnsResolverNextCandidate` and `dnsResolverDone` in this module.
   */
  candidate: i32[]
  /** @internal Used by `dnsResolverNextCandidate` in this module. */
  candidates: i32[]
  /**
   * The error a lookup ends with if no later candidate answers: a family that reached no server while the other was NXDOMAIN, or 0.
   * @internal Used by `dnsResolverDone` in this module.
   */
  fallback: i32[]
  /** @internal Used by `dnsResolverNextCandidate` in this module. */
  dots: i32[]
  /** @internal Used by `dnsResolverFinishNow` and `dnsResolverFinish` in this module. */
  lookupState: i32[]
  /** @internal Used by `dnsResolverFinishNow` and `dnsResolverFinish` in this module. */
  lookupResult: i32[]
  private lookupPort: i32[]
  /** @internal Used by `dnsResolverCheckQuery` in this module; DnsClient's constructor and `DnsClient.tokens` in std/net/dns.ts. */
  maxLookups: i32 = 0
  /** Where `nextOutgoing` looks first, so no query waits behind another forever. */
  private cursor: i32 = 0
  /** Datagrams dropped for coming from another address or port than the server's. */
  droppedSource: i32 = 0
  /** Replies dropped for another ID. */
  droppedId: i32 = 0
  /** Replies dropped for another question. */
  droppedQuestion: i32 = 0
  /** Datagrams dropped as malformed, or arriving for a query not waiting on UDP. */
  droppedMalformed: i32 = 0
  /** Tries that timed out. */
  timeouts: i32 = 0
  /**
   * Tries that failed, for any reason: a timeout (also counted in `timeouts`),
   * SERVFAIL, REFUSED, FORMERR, NOTIMP, a bad TCP reply or a socket failure.
   */
  serverFailures: i32 = 0
  /** Truncated replies asked again over TCP. */
  tcpRetries: i32 = 0
  /** Queries a CNAME chain added. */
  cnameQueries: i32 = 0
  /** Queries handed to the driver, UDP and TCP. */
  sent: i32 = 0

  /**
   * A resolver with room for `maxLookups` lookups at once, every buffer made
   * now. Panics unless `maxLookups` is 1 to `DNS_RESOLVER_MAX_LOOKUPS`.
   * `config` and `hosts` are kept, not copied: `start` reads both, and a
   * running query reads `config`'s servers, search list, `searchCount`,
   * `ndots`, `timeout` and `attempts`, so a program may parse them again
   * between lookups but not while one runs.
   *
   * @param config The servers, search list, `ndots`, `timeout` (seconds) and
   *   `attempts`, as `dnsParseResolvConf` read them.
   * @param hosts The hosts table answered before any packet is sent, or `null`
   *   for none.
   * @param maxLookups How many lookups may run at once, 1 to
   *   `DNS_RESOLVER_MAX_LOOKUPS` (64). Each holds the buffers of two queries,
   *   among them a `DNS_TCP_MAX_REPLY` (16 KiB) TCP reply buffer apiece.
   */
  constructor(config: DnsConfig, hosts: DnsHosts | null, maxLookups: i32) {
    if (maxLookups < 1 || maxLookups > DNS_RESOLVER_MAX_LOOKUPS) {
      panic(`DnsResolver: ${maxLookups} lookups is outside 1 to ${DNS_RESOLVER_MAX_LOOKUPS}`)
    }
    this.config = config
    this.hosts = hosts
    this.maxLookups = maxLookups
    const n: i32 = maxLookups * 2
    this.queries = []
    this.names = []
    this.starts = []
    this.streams = []
    this.answers = []
    this.answerTtls = []
    this.bases = []
    this.lookupAddresses = []
    this.lookupTtls = []
    let q: i32 = 0
    while (q < n) {
      this.queries.push(new Array<u8>(DNS_QUERY_MAX_BYTES))
      this.names.push(new Array<u8>(DNS_MAX_NAME_BYTES))
      this.starts.push(new Array<u8>(DNS_MAX_NAME_BYTES))
      this.streams.push(new Array<u8>(DNS_TCP_MAX_REPLY))
      this.answers.push(new Array<u8>(DNS_MAX_ANSWERS * DNS_ADDRESS_BYTES))
      this.answerTtls.push(new Array<i32>(DNS_MAX_ANSWERS))
      q += 1
    }
    let l: i32 = 0
    while (l < maxLookups) {
      this.bases.push(new Array<u8>(DNS_MAX_NAME_BYTES))
      this.lookupAddresses.push(new Array<u8>(DNS_RESOLVE_MAX_ADDRESSES * DNS_ADDRESS_BYTES))
      this.lookupTtls.push(new Array<i32>(DNS_RESOLVE_MAX_ADDRESSES))
      l += 1
    }
    this.reply = new DnsReply()
    this.scratch = new Array<u8>(DNS_QUERY_MAX_BYTES)
    this.queryLength = new Array<i32>(n)
    this.nameLength = new Array<i32>(n)
    this.state = new Array<i32>(n)
    this.outcome = new Array<i32>(n)
    this.pending = new Array<i32>(n)
    this.server = new Array<i32>(n)
    this.round = new Array<i32>(n)
    this.hops = new Array<i32>(n)
    this.deadline = new Array<i64>(n)
    this.streamHave = new Array<i32>(n)
    this.streamWant = new Array<i32>(n)
    this.baseLength = new Array<i32>(maxLookups)
    this.nxdomain = new Array<boolean>(n)
    this.absolute = new Array<boolean>(maxLookups)
    this.candidate = new Array<i32>(maxLookups)
    this.candidates = new Array<i32>(maxLookups)
    this.fallback = new Array<i32>(maxLookups)
    this.dots = new Array<i32>(maxLookups)
    this.lookupState = new Array<i32>(maxLookups)
    this.lookupResult = new Array<i32>(maxLookups)
    this.lookupPort = new Array<i32>(maxLookups)
  }

  /**
   * Begins a lookup of `name`, whose addresses will carry `port`, at
   * `nowNanos` on the caller's monotonic clock, and answers its id, or a
   * negative code: `DNS_RESOLVE_BUSY` when every slot is in use, or the
   * `DNS_ERR_*` `dnsBuildQuery` gives a name that is not one.
   *
   * `localhost` and any name under it answer 127.0.0.1 and ::1 (RFC 6761
   * §6.3), an address literal answers itself, and a name in `hosts` answers
   * its entries, each at once and with no packet: `result` has them now,
   * with TTL 0. Panics when `port` is not 16 bits.
   *
   * @param name The name to look up: a host name, relative or with a trailing
   *   dot, or an IPv4 or IPv6 literal.
   * @param port The port, 0 to 0xFFFF, written into every address `result`
   *   gives.
   * @param nowNanos The caller's monotonic clock now, in nanoseconds; the first
   *   tries' deadlines are `timeout` seconds after it.
   * @returns The lookup's slot, 0 to `maxLookups - 1`, to pass to `result` or
   *   `cancel`; or `DNS_RESOLVE_BUSY`, or a negative `DNS_ERR_*` code from
   *   `dnsBuildQuery`, when no lookup was started.
   */
  start(name: string, port: i32, nowNanos: i64): i32 {
    if (port < 0 || port > 0xffff) {
      panic(`DnsResolver.start: the port ${port} is not 16 bits`)
    }
    let l: i32 = 0
    while (l < this.maxLookups && this.lookupState[l] !== DNS_L_FREE) {
      l += 1
    }
    if (l === this.maxLookups) {
      return DNS_RESOLVE_BUSY
    }
    this.state[l * 2] = DNS_Q_IDLE
    this.state[l * 2 + 1] = DNS_Q_IDLE
    const at: u8[] = this.lookupAddresses[l]
    const ttls: i32[] = this.lookupTtls[l]
    if (dnsResolverIsLocalhost(name)) {
      dnsResolverLoopback(at, port)
      ttls[0] = 0
      ttls[1] = 0
      return dnsResolverFinishNow(this, l, 2)
    }
    if (dnsResolverLiteral(this.scratch, name, at, port)) {
      ttls[0] = 0
      return dnsResolverFinishNow(this, l, 1)
    }
    const built: i32 = dnsBuildQuery(this.scratch, 0, name, DNS_TYPE_A)
    if (built < 0) {
      return built
    }
    const hosts: DnsHosts | null = this.hosts
    if (hosts !== null) {
      const v4: i32 = dnsHostsFind(hosts, name, DNS_TYPE_A, port, this.answers[l * 2], DNS_MAX_ANSWERS)
      const v6: i32 = dnsHostsFind(hosts, name, DNS_TYPE_AAAA, port, this.answers[l * 2 + 1], DNS_MAX_ANSWERS)
      if (v4 + v6 > 0) {
        dnsResolverGather(this, l, v4, v6, false)
        return dnsResolverFinishNow(this, l, v4 + v6)
      }
    }
    // The wire name is the query's bytes after the header, less the root byte
    // and the question's type and class.
    const base: u8[] = this.bases[l]
    const baseLength: i32 = built - 12 - 5
    let i: i32 = 0
    let dots: i32 = 0
    while (i < baseLength && i < toI32(base.length)) {
      base[i] = this.scratch[12 + i]
      i += 1
    }
    // Every length byte past the first is a dot of the name.
    let p: i32 = 0
    while (p >= 0 && p < baseLength && p < toI32(base.length)) {
      p += toI32(base[p]) + 1
      if (p < baseLength) {
        dots += 1
      }
    }
    this.baseLength[l] = baseLength
    this.absolute[l] = toI32(name.charCodeAt(toI32(name.length) - 1)) === 46
    this.dots[l] = dots
    this.candidate[l] = 0
    this.fallback[l] = 0
    this.candidates[l] = this.absolute[l] ? 1 : this.config.searchCount + 1
    this.lookupPort[l] = port
    this.lookupState[l] = DNS_L_RUNNING
    this.lookupResult[l] = DNS_RESOLVE_PENDING
    if (!dnsResolverNextCandidate(this, l, nowNanos)) {
      dnsResolverFinish(this, l, DNS_RESOLVE_NOT_FOUND)
    }
    return l
  }

  /**
   * The next thing the driver must do, or -1 when there is nothing: the
   * query it is for, with `meta[0]` one of `DNS_SEND_UDP`, `DNS_SEND_TCP` or
   * `DNS_CLOSE`. A send writes `meta[1]` bytes to `out` from offset 0 (TCP's
   * with their two-byte length) and the server's address to `to`, and draws
   * the query `id`, which must be new and random for each send since it is
   * half of what keeps an off-path spoofer out; it also replaces whatever
   * socket the query held, so the driver closes that one first. Panics when
   * `out` is shorter than `DNS_OUTGOING_MAX_BYTES`, `to` shorter than 18
   * bytes or `meta` than 2, or when `id` is not 16 bits.
   *
   * Queries take turns, so a query that always has work does not starve the
   * rest. Call it until it answers -1 after every `start`, `receive`,
   * `receiveStream`, `fail`, `tick` and `cancel`.
   *
   * @param out Where a send's bytes go, from offset 0; at least
   *   `DNS_OUTGOING_MAX_BYTES` long.
   * @param to Where the server's 18-byte address (IPv6 form and port) goes for
   *   a send; left as it was for a close.
   * @param meta Two slots: `meta[0]` gets the action, `meta[1]` the number of
   *   bytes of `out` to send (0 for `DNS_CLOSE`); not written when the call
   *   answers -1.
   * @param id The ID for this send, 0 to 0xFFFF: fresh and random each call.
   *   A close or no action does not use it.
   * @returns The query the action is for, 0 to `2 * maxLookups - 1` (its
   *   lookup is the query divided by 2), or -1 when nothing is owed.
   */
  nextOutgoing(out: u8[], to: u8[], meta: i32[], id: i32): i32 {
    if (id < 0 || id > 0xffff) {
      panic(`DnsResolver.nextOutgoing: the id ${id} is not 16 bits`)
    }
    if (
      toI32(out.length) < DNS_OUTGOING_MAX_BYTES ||
      toI32(to.length) < DNS_ADDRESS_BYTES ||
      toI32(meta.length) < 2
    ) {
      panic("DnsResolver.nextOutgoing: out, to or meta is too short")
    }
    const n: i32 = this.maxLookups * 2
    let k: i32 = 0
    while (k < n) {
      const q: i32 = (this.cursor + k) % n
      const kind: i32 = this.pending[q]
      if (kind !== 0) {
        this.pending[q] = 0
        this.cursor = (q + 1) % n
        meta[0] = kind
        meta[1] = 0
        if (kind === DNS_CLOSE) {
          return q
        }
        const query: u8[] = this.queries[q]
        setU16BE(query, 0, toU16(id))
        const length: i32 = this.queryLength[q]
        const skip: i32 = kind === DNS_SEND_TCP ? 2 : 0
        if (skip === 2) {
          setU16BE(out, 0, toU16(length))
        }
        let i: i32 = 0
        while (i < length && i < toI32(query.length)) {
          out[skip + i] = query[i]
          i += 1
        }
        meta[1] = skip + length
        const from: i32 = this.server[q] * DNS_ADDRESS_BYTES
        i = 0
        while (i < DNS_ADDRESS_BYTES && i < toI32(to.length)) {
          to[i] = this.config.servers[from + i]
          i += 1
        }
        this.sent = dnsResolverCount(this.sent)
        return q
      }
      k += 1
    }
    return -1
  }

  /**
   * A datagram of `len` bytes from `buf[0]` that arrived from `from` on query
   * `q`'s socket at `nowNanos`. One from another address or port than the
   * server's, with another ID or question, or malformed, is dropped and
   * counted, and the query keeps waiting. One that answers the query with an
   * RCODE the resolver does not read, FORMERR or NOTIMP, or with SERVFAIL or
   * REFUSED, fails the server. A truncated reply asks again over TCP. Panics
   * when `q` is not a query, `len` is outside `buf` or `from` is shorter than
   * 18 bytes. `buf` is read only during the call.
   *
   * @param q The query whose socket the datagram arrived on, as `nextOutgoing`
   *   answered it.
   * @param buf The datagram, from offset 0.
   * @param len How many bytes of `buf` the datagram is.
   * @param from The sender's 18-byte address, IPv6 form and port, compared with
   *   the server's.
   * @param nowNanos The caller's monotonic clock now, in nanoseconds.
   */
  receive(q: i32, buf: u8[], len: i32, from: u8[], nowNanos: i64): void {
    dnsResolverCheckQuery(this, q, "receive")
    if (len < 0 || len > toI32(buf.length) || toI32(from.length) < DNS_ADDRESS_BYTES) {
      panic("DnsResolver.receive: len is outside buf, or from is shorter than 18 bytes")
    }
    if (this.state[q] !== DNS_Q_UDP) {
      this.droppedMalformed = dnsResolverCount(this.droppedMalformed)
      return
    }
    const at: i32 = this.server[q] * DNS_ADDRESS_BYTES
    let i: i32 = 0
    while (i < DNS_ADDRESS_BYTES && i < toI32(from.length)) {
      if (from[i] !== this.config.servers[at + i]) {
        this.droppedSource = dnsResolverCount(this.droppedSource)
        return
      }
      i += 1
    }
    const status: i32 = dnsParseReply(
      buf,
      len,
      this.queries[q],
      this.queryLength[q],
      this.lookupPort[q / 2],
      this.reply
    )
    if (status === DNS_ERR_ID) {
      this.droppedId = dnsResolverCount(this.droppedId)
    } else if (status === DNS_ERR_QUESTION) {
      this.droppedQuestion = dnsResolverCount(this.droppedQuestion)
    } else if (status === DNS_ERR_RCODE) {
      dnsResolverServerFailed(this, q, nowNanos)
    } else if (status < 0) {
      this.droppedMalformed = dnsResolverCount(this.droppedMalformed)
    } else if (this.reply.truncated) {
      this.tcpRetries = dnsResolverCount(this.tcpRetries)
      dnsResolverSend(this, q, DNS_Q_TCP, nowNanos)
    } else {
      dnsResolverAnswer(this, q, status, nowNanos)
    }
  }

  /**
   * `len` bytes from `buf[0]` read from query `q`'s TCP socket at
   * `nowNanos`. A length over `DNS_TCP_MAX_REPLY`, a reply that is malformed
   * or answers another question, or one still truncated fails the server,
   * since a stream cannot carry a second, true reply after it. So does a
   * length under the 12-byte header. Bytes for a query not waiting on TCP, or
   * past the reply's length, are ignored. Panics when `q` is not a query or
   * `len` is outside `buf`. The bytes are copied, so `buf` may be reused.
   *
   * @param q The query whose TCP socket the bytes came from.
   * @param buf The bytes read, from offset 0, in any slicing of the stream:
   *   the two-byte length and the reply may arrive a byte at a time.
   * @param len How many bytes of `buf` were read.
   * @param nowNanos The caller's monotonic clock now, in nanoseconds.
   */
  receiveStream(q: i32, buf: u8[], len: i32, nowNanos: i64): void {
    dnsResolverCheckQuery(this, q, "receiveStream")
    if (len < 0 || len > toI32(buf.length)) {
      panic("DnsResolver.receiveStream: len is outside buf")
    }
    if (this.state[q] !== DNS_Q_TCP) {
      return
    }
    const stream: u8[] = this.streams[q]
    let i: i32 = 0
    while (i < len) {
      const have: i32 = this.streamHave[q]
      if (have < 2) {
        this.streamWant[q] = (this.streamWant[q] << 8) | toI32(buf[i])
        if (have === 1 && (this.streamWant[q] < 12 || this.streamWant[q] > DNS_TCP_MAX_REPLY)) {
          dnsResolverServerFailed(this, q, nowNanos)
          return
        }
      } else if (have - 2 < this.streamWant[q]) {
        stream[have - 2] = buf[i]
      }
      this.streamHave[q] = have + 1
      i += 1
    }
    const want: i32 = this.streamWant[q]
    if (this.streamHave[q] < 2 || this.streamHave[q] - 2 < want) {
      return
    }
    const status: i32 = dnsParseReply(
      stream,
      want,
      this.queries[q],
      this.queryLength[q],
      this.lookupPort[q / 2],
      this.reply
    )
    if (status < 0 || this.reply.truncated) {
      dnsResolverServerFailed(this, q, nowNanos)
    } else {
      dnsResolverAnswer(this, q, status, nowNanos)
    }
  }

  /**
   * The driver's word that query `q`'s socket failed at `nowNanos`: it could
   * not be opened or written, the connection was refused, or the stream
   * ended before the reply did. The query moves to the next server, or after
   * `attempts` rounds this query ends as `DNS_RESOLVE_NO_ANSWER` (its lookup
   * moves to the next candidate when its other query was NXDOMAIN). A query
   * not waiting on a socket ignores it. Panics when `q` is not a query.
   *
   * @param q The query whose socket failed.
   * @param nowNanos The caller's monotonic clock now, in nanoseconds.
   */
  fail(q: i32, nowNanos: i64): void {
    dnsResolverCheckQuery(this, q, "fail")
    if (this.state[q] === DNS_Q_UDP || this.state[q] === DNS_Q_TCP) {
      dnsResolverServerFailed(this, q, nowNanos)
    }
  }

  /**
   * Moves every query whose try has reached its deadline at `nowNanos` to the
   * next server, counting each in `timeouts`; a query past its last round
   * ends as `DNS_RESOLVE_NO_ANSWER`. Calling it early does no harm.
   *
   * @param nowNanos The caller's monotonic clock now, in nanoseconds.
   */
  tick(nowNanos: i64): void {
    const n: i32 = this.maxLookups * 2
    let q: i32 = 0
    while (q < n) {
      if ((this.state[q] === DNS_Q_UDP || this.state[q] === DNS_Q_TCP) && this.deadline[q] <= nowNanos) {
        this.timeouts = dnsResolverCount(this.timeouts)
        dnsResolverServerFailed(this, q, nowNanos)
      }
      q += 1
    }
  }

  /**
   * The earliest deadline of any try in flight, so the driver knows how long
   * it may wait before calling `tick`.
   *
   * @returns That deadline in nanoseconds on the caller's monotonic clock, or
   *   -1 when no try is in flight.
   */
  nextDeadlineNanos(): i64 {
    const n: i32 = this.maxLookups * 2
    let soonest: i64 = -1
    let q: i32 = 0
    while (q < n) {
      if (
        (this.state[q] === DNS_Q_UDP || this.state[q] === DNS_Q_TCP) &&
        (soonest < 0 || this.deadline[q] < soonest)
      ) {
        soonest = this.deadline[q]
      }
      q += 1
    }
    return soonest
  }

  /**
   * Lookup `lookup`'s answer: `DNS_RESOLVE_PENDING` while it runs, or, once
   * it has finished, its address count with the addresses written to `out`
   * (A first, then AAAA, 18 bytes each, with the port `start` was given) and
   * their TTLs in seconds to `ttls`, or a negative `DNS_RESOLVE_*` code. A
   * finished lookup's slot is free again once this has answered it. Panics
   * when `lookup` is not a lookup in progress (never started, cancelled, or
   * its answer already read), or when `out` or `ttls` has no room for
   * `DNS_RESOLVE_MAX_ADDRESSES`.
   *
   * @param lookup The slot `start` answered.
   * @param out Where the addresses go, from offset 0: at least
   *   `DNS_RESOLVE_MAX_ADDRESSES * DNS_ADDRESS_BYTES` bytes.
   * @param ttls Where each address's TTL goes, in seconds, 0 for one that
   *   needed no packet: at least `DNS_RESOLVE_MAX_ADDRESSES` long.
   * @returns `DNS_RESOLVE_PENDING` while the lookup runs; then the address
   *   count, 1 to `DNS_RESOLVE_MAX_ADDRESSES`, or `DNS_RESOLVE_NOT_FOUND`,
   *   `DNS_RESOLVE_NO_ANSWER` or `DNS_RESOLVE_CNAME`.
   */
  result(lookup: i32, out: u8[], ttls: i32[]): i32 {
    if (lookup < 0 || lookup >= this.maxLookups || this.lookupState[lookup] === DNS_L_FREE) {
      panic(`DnsResolver.result: ${lookup} is not a lookup in progress`)
    }
    if (
      toI32(out.length) < DNS_RESOLVE_MAX_ADDRESSES * DNS_ADDRESS_BYTES ||
      toI32(ttls.length) < DNS_RESOLVE_MAX_ADDRESSES
    ) {
      panic("DnsResolver.result: out or ttls has no room for DNS_RESOLVE_MAX_ADDRESSES")
    }
    if (this.lookupState[lookup] !== DNS_L_DONE) {
      return DNS_RESOLVE_PENDING
    }
    const count: i32 = this.lookupResult[lookup]
    let i: i32 = 0
    while (i < count * DNS_ADDRESS_BYTES && i < toI32(out.length)) {
      out[i] = this.lookupAddresses[lookup][i]
      i += 1
    }
    i = 0
    while (i < count && i < toI32(ttls.length)) {
      ttls[i] = this.lookupTtls[lookup][i]
      i += 1
    }
    this.lookupState[lookup] = DNS_L_FREE
    return count
  }

  /**
   * Ends `lookup` now, whether or not it has finished, and frees its slot;
   * each of its queries that may hold a socket is owed a `DNS_CLOSE`, which
   * `nextOutgoing` hands out in its turn. Panics when `lookup` is not a lookup in
   * progress, as `result` does.
   *
   * @param lookup The slot `start` answered.
   */
  cancel(lookup: i32): void {
    if (lookup < 0 || lookup >= this.maxLookups || this.lookupState[lookup] === DNS_L_FREE) {
      panic(`DnsResolver.cancel: ${lookup} is not a lookup in progress`)
    }
    dnsResolverStop(this, lookup * 2)
    dnsResolverStop(this, lookup * 2 + 1)
    this.lookupState[lookup] = DNS_L_FREE
  }

  /**
   * Ends `lookup` now with the addresses it already has, when one of its
   * current name's two queries has answered with addresses and the other is
   * still asking; the one still asking is owed a `DNS_CLOSE`, as `cancel`
   * owes one. Otherwise the lookup is left as it was. A driver whose own time
   * is up calls this before `cancel`, so a network that never answers AAAA
   * still gives the A addresses it found. Panics when `lookup` is not a
   * lookup in progress, as `result` does.
   *
   * @param lookup The slot `start` answered.
   * @returns Whether the lookup has now finished, its answer for `result`
   *   to read; true for one that had finished already.
   */
  settle(lookup: i32): boolean {
    if (lookup < 0 || lookup >= this.maxLookups || this.lookupState[lookup] === DNS_L_FREE) {
      panic(`DnsResolver.settle: ${lookup} is not a lookup in progress`)
    }
    if (this.lookupState[lookup] === DNS_L_DONE) {
      return true
    }
    const a: i32 = lookup * 2
    let open: i32 = -1
    if (this.state[a] === DNS_Q_DONE && this.outcome[a] > 0) {
      open = a + 1
    } else if (this.state[a + 1] === DNS_Q_DONE && this.outcome[a + 1] > 0) {
      open = a
    }
    if (open < 0 || this.state[open] === DNS_Q_DONE) {
      return false
    }
    // The other has addresses, so this finishes the lookup and never reaches a next name, which alone reads the clock.
    dnsResolverDone(this, open, DNS_RESOLVE_NO_ANSWER, 0)
    return true
  }

  /**
   * How many slots are taken.
   *
   * @returns How many lookups are in progress or hold an answer not yet read,
   *   0 to `maxLookups`.
   */
  active(): i32 {
    let count: i32 = 0
    let l: i32 = 0
    while (l < this.maxLookups) {
      if (this.lookupState[l] !== DNS_L_FREE) {
        count += 1
      }
      l += 1
    }
    return count
  }
}

/** Panics unless `q` names one of `r`'s queries. */
const dnsResolverCheckQuery = (r: DnsResolver, q: i32, who: string): void => {
  if (q < 0 || q >= r.maxLookups * 2) {
    panic(`DnsResolver.${who}: ${q} is not a query`)
  }
}

/** `n` plus one, held at the i32 maximum, so a counter a peer drives never overflows. */
const dnsResolverCount = (n: i32): i32 => (n < 2147483647 ? n + 1 : n)

/** Whether `name` is `localhost` or a name under it, in any case, with or without the root's dot, and with no empty label before `localhost`. */
const dnsResolverIsLocalhost = (name: string): boolean => {
  let n: i32 = toI32(name.length)
  if (n > 0 && toI32(name.charCodeAt(n - 1)) === 46) {
    n -= 1
  }
  const word: string = "localhost"
  if (n < 9 || (n > 9 && toI32(name.charCodeAt(n - 10)) !== 46)) {
    return false
  }
  // `.localhost` and `x..localhost` have an empty label, so are no name.
  if (n === 10 || (n > 10 && toI32(name.charCodeAt(n - 11)) === 46)) {
    return false
  }
  let i: i32 = 0
  while (i < 9 && i < toI32(word.length)) {
    let b: i32 = toI32(name.charCodeAt(n - 9 + i))
    if (b >= 65 && b <= 90) {
      b += 32
    }
    if (b !== toI32(word.charCodeAt(i))) {
      return false
    }
    i += 1
  }
  return true
}

/** Writes 127.0.0.1 then ::1, both with `port`, to `out`. */
const dnsResolverLoopback = (out: u8[], port: i32): void => {
  let i: i32 = 0
  while (i < 2 * DNS_ADDRESS_BYTES && i < toI32(out.length)) {
    out[i] = toU8(0)
    i += 1
  }
  out[10] = toU8(255)
  out[11] = toU8(255)
  out[12] = toU8(127)
  out[15] = toU8(1)
  setU16BE(out, 16, toU16(port))
  out[DNS_ADDRESS_BYTES + 15] = toU8(1)
  setU16BE(out, DNS_ADDRESS_BYTES + 16, toU16(port))
}

/**
 * Whether `name` is an IPv4 or IPv6 literal, which is then written to `out`
 * with `port`. `scratch` holds the name's bytes for the parser.
 */
const dnsResolverLiteral = (scratch: u8[], name: string, out: u8[], port: i32): boolean => {
  const n: i32 = toI32(name.length)
  if (n === 0 || n > toI32(scratch.length)) {
    return false
  }
  let i: i32 = 0
  while (i < n) {
    const b: i32 = toI32(name.charCodeAt(i))
    if (b > 127) {
      return false
    }
    scratch[i] = toU8(b)
    i += 1
  }
  return dnsParseAddress(scratch, 0, n, out, 0, port)
}

/** Finishes lookup `l` before any query was sent, with `count` addresses already in place. */
const dnsResolverFinishNow = (r: DnsResolver, l: i32, count: i32): i32 => {
  r.lookupState[l] = DNS_L_DONE
  r.lookupResult[l] = count
  return l
}

/** Ends lookup `l` with `result`, and owes the driver a close for each of its queries still holding a socket. */
const dnsResolverFinish = (r: DnsResolver, l: i32, result: i32): void => {
  dnsResolverStop(r, l * 2)
  dnsResolverStop(r, l * 2 + 1)
  r.lookupState[l] = DNS_L_DONE
  r.lookupResult[l] = result
}

/** Stops query `q`, and owes the driver a close if a socket may be open for it. */
const dnsResolverStop = (r: DnsResolver, q: i32): void => {
  if (r.state[q] === DNS_Q_UDP || r.state[q] === DNS_Q_TCP || r.pending[q] !== 0) {
    r.pending[q] = DNS_CLOSE
  }
  if (r.state[q] !== DNS_Q_IDLE) {
    r.state[q] = DNS_Q_DONE
  }
}

/**
 * Copies `v4` A and `v6` AAAA addresses from lookup `l`'s two queries into
 * its answer, A first. From a server, every address of a type gets the
 * smallest TTL among them, the TTL of the RRset (RFC 2181 §5.2); from the
 * hosts file, `fromServer` false, each gets 0, since nothing says how long
 * the file holds.
 */
const dnsResolverGather = (r: DnsResolver, l: i32, v4: i32, v6: i32, fromServer: boolean): void => {
  const out: u8[] = r.lookupAddresses[l]
  const ttls: i32[] = r.lookupTtls[l]
  let k: i32 = 0
  let half: i32 = 0
  while (half < 2) {
    const q: i32 = l * 2 + half
    const count: i32 = half === 0 ? v4 : v6
    let least: i32 = 0
    let j: i32 = 0
    while (fromServer && j < count) {
      const t: i32 = r.answerTtls[q][j]
      if (j === 0 || t < least) {
        least = t
      }
      j += 1
    }
    let i: i32 = 0
    while (i < count && k >= 0 && k < toI32(ttls.length)) {
      let b: i32 = 0
      while (b < DNS_ADDRESS_BYTES) {
        out[k * DNS_ADDRESS_BYTES + b] = r.answers[q][i * DNS_ADDRESS_BYTES + b]
        b += 1
      }
      ttls[k] = least
      k += 1
      i += 1
    }
    half += 1
  }
}

/**
 * Starts lookup `l`'s current candidate name, skipping any the search list
 * makes too long, and answers whether there was one to start.
 *
 * The order is resolv.conf(5)'s: a name with a trailing dot is only itself; a
 * name with at least `ndots` dots is itself and then each search suffix; any
 * other name is each suffix and then itself.
 */
const dnsResolverNextCandidate = (r: DnsResolver, l: i32, nowNanos: i64): boolean => {
  while (r.candidate[l] < r.candidates[l]) {
    const c: i32 = r.candidate[l]
    const search: i32 = r.config.searchCount
    let suffix: i32 = -1
    if (!r.absolute[l]) {
      if (r.dots[l] >= r.config.ndots) {
        suffix = c - 1
      } else {
        suffix = c < search ? c : -1
      }
    }
    const a: i32 = l * 2
    const length: i32 = dnsResolverCandidate(r, l, suffix, r.names[a])
    if (length > 0) {
      dnsResolverBegin(r, a, length, DNS_TYPE_A, nowNanos)
      let i: i32 = 0
      while (i < length) {
        r.names[a + 1][i] = r.names[a][i]
        i += 1
      }
      dnsResolverBegin(r, a + 1, length, DNS_TYPE_AAAA, nowNanos)
      return true
    }
    r.candidate[l] = c + 1
  }
  return false
}

/**
 * Writes lookup `l`'s name, with search suffix `suffix` appended unless it
 * is -1, into `out` in wire form with its root byte, and answers its length,
 * or 0 when the suffix is not a name of labels or makes the name over 255
 * bytes.
 */
const dnsResolverCandidate = (r: DnsResolver, l: i32, suffix: i32, out: u8[]): i32 => {
  const base: u8[] = r.bases[l]
  let n: i32 = r.baseLength[l]
  let i: i32 = 0
  while (i < n && i < toI32(out.length) && i < toI32(base.length)) {
    out[i] = base[i]
    i += 1
  }
  if (suffix >= 0) {
    const start: i32 = r.config.searchStart[suffix]
    const length: i32 = r.config.searchLength[suffix]
    // The suffix's text becomes labels: each dot, and its end, closes the
    // label whose length byte sits at `n`.
    let label: i32 = 0
    let k: i32 = 0
    while (k <= length) {
      const b: i32 = k < length ? toI32(r.config.search[start + k]) : 46
      if (b === 46) {
        if (label === 0 || label > DNS_MAX_LABEL_BYTES || n < 0 || n >= toI32(out.length)) {
          return 0
        }
        out[n] = toU8(label)
        n += label + 1
        label = 0
      } else if (b < 33 || b > 126 || n + 1 + label > DNS_MAX_NAME_BYTES - 2) {
        return 0
      } else {
        out[n + 1 + label] = toU8(b)
        label += 1
      }
      k += 1
    }
  }
  if (n + 1 > DNS_MAX_NAME_BYTES) {
    return 0
  }
  out[n] = toU8(0)
  return n + 1
}

/**
 * Makes query `q` ask `qtype` for the `length`-byte wire name in
 * `r.names[q]`, as the start of a new chain, and sends it to the first
 * server.
 */
const dnsResolverBegin = (r: DnsResolver, q: i32, length: i32, qtype: i32, nowNanos: i64): void => {
  r.hops[q] = 0
  r.nameLength[q] = length
  let i: i32 = 0
  while (i < length) {
    const b: i32 = toI32(r.names[q][i])
    r.starts[q][i] = toU8(b >= 65 && b <= 90 ? b + 32 : b)
    i += 1
  }
  dnsResolverAsk(r, q, qtype, nowNanos)
}

/** Writes query `q`'s bytes for its current name and `qtype`, ID 0 until it is sent, and sends it to the first server. */
const dnsResolverAsk = (r: DnsResolver, q: i32, qtype: i32, nowNanos: i64): void => {
  const query: u8[] = r.queries[q]
  const length: i32 = r.nameLength[q]
  // The bytes are dnsBuildQuery's: the ID, RD, one question, then the name, type and class IN.
  setU16BE(query, 0, toU16(0))
  setU16BE(query, 2, toU16(0x0100))
  setU16BE(query, 4, toU16(1))
  setU16BE(query, 6, toU16(0))
  setU16BE(query, 8, toU16(0))
  setU16BE(query, 10, toU16(0))
  let i: i32 = 0
  while (i < length && 12 + i < toI32(query.length)) {
    query[12 + i] = r.names[q][i]
    i += 1
  }
  setU16BE(query, 12 + length, toU16(qtype))
  setU16BE(query, 14 + length, toU16(1))
  r.queryLength[q] = 16 + length
  // Only this name's reply may say NXDOMAIN, not an earlier candidate's or lookup's.
  r.nxdomain[q] = false
  r.server[q] = 0
  r.round[q] = 0
  dnsResolverSend(r, q, DNS_Q_UDP, nowNanos)
}

/** Owes the driver a send of query `q` to its current server over `how`, with a deadline `timeout` seconds after `nowNanos`. */
const dnsResolverSend = (r: DnsResolver, q: i32, how: i32, nowNanos: i64): void => {
  r.state[q] = how
  r.pending[q] = how === DNS_Q_TCP ? DNS_SEND_TCP : DNS_SEND_UDP
  r.streamHave[q] = 0
  r.streamWant[q] = 0
  r.deadline[q] = nowNanos + toI64(r.config.timeout) * toI64(1000000000)
}

/**
 * Query `q`'s try failed: it moves to the next server, and after the last
 * server to the next round, and after `attempts` rounds it is
 * `DNS_RESOLVE_NO_ANSWER`.
 */
const dnsResolverServerFailed = (r: DnsResolver, q: i32, nowNanos: i64): void => {
  r.serverFailures = dnsResolverCount(r.serverFailures)
  r.server[q] = r.server[q] + 1
  if (r.server[q] >= r.config.serverCount) {
    r.server[q] = 0
    r.round[q] = r.round[q] + 1
  }
  if (r.round[q] >= r.config.attempts) {
    dnsResolverDone(r, q, DNS_RESOLVE_NO_ANSWER, nowNanos)
    return
  }
  dnsResolverSend(r, q, DNS_Q_UDP, nowNanos)
}

/**
 * Query `q`'s reply, whose status `dnsParseReply` answered and which is in
 * `r.reply`: its addresses, NXDOMAIN, NODATA, a CNAME to ask after, or a
 * failure of the server.
 */
const dnsResolverAnswer = (r: DnsResolver, q: i32, status: i32, nowNanos: i64): void => {
  const reply: DnsReply = r.reply
  r.nxdomain[q] = status === DNS_NXDOMAIN
  if (status === DNS_NXDOMAIN) {
    dnsResolverDone(r, q, DNS_RESOLVE_NOT_FOUND, nowNanos)
    return
  }
  if (status !== DNS_NOERROR) {
    dnsResolverServerFailed(r, q, nowNanos)
    return
  }
  if (reply.count > 0) {
    let i: i32 = 0
    while (i < reply.count * DNS_ADDRESS_BYTES) {
      r.answers[q][i] = reply.addresses[i]
      i += 1
    }
    i = 0
    while (i < reply.count) {
      r.answerTtls[q][i] = reply.ttls[i]
      i += 1
    }
    dnsResolverDone(r, q, reply.count, nowNanos)
    return
  }
  if (dnsResolverSameName(reply.chain, reply.asked)) {
    dnsResolverDone(r, q, DNS_RESOLVE_NOT_FOUND, nowNanos)
    return
  }
  // The chain left the reply without an address: ask for its end.
  if (r.hops[q] >= DNS_RESOLVER_MAX_CNAME_HOPS || dnsResolverSameName(reply.chain, r.starts[q])) {
    dnsResolverDone(r, q, DNS_RESOLVE_CNAME, nowNanos)
    return
  }
  r.hops[q] = r.hops[q] + 1
  r.cnameQueries = dnsResolverCount(r.cnameQueries)
  const length: i32 = dnsResolverNameLength(reply.chain)
  let i: i32 = 0
  while (i < length) {
    r.names[q][i] = reply.chain[i]
    i += 1
  }
  r.nameLength[q] = length
  dnsResolverAsk(r, q, (q & 1) === 0 ? DNS_TYPE_A : DNS_TYPE_AAAA, nowNanos)
}

/** The length of the wire name in `name`, its root byte included, read label by label since a label may hold a 0 byte. */
const dnsResolverNameLength = (name: u8[]): i32 => {
  let i: i32 = 0
  while (i >= 0 && i < toI32(name.length) && name[i] !== toU8(0)) {
    i += toI32(name[i]) + 1
  }
  return i + 1
}

/** Whether the lowercase wire names `a` and `b` are the same name. */
const dnsResolverSameName = (a: u8[], b: u8[]): boolean => {
  const n: i32 = dnsResolverNameLength(a)
  let i: i32 = 0
  while (i < n && i < toI32(a.length) && i < toI32(b.length)) {
    if (a[i] !== b[i]) {
      return false
    }
    i += 1
  }
  return true
}

/**
 * Query `q` has finished with `outcome`, its address count or a
 * `DNS_RESOLVE_*` code; once its lookup's other query has too, the lookup
 * finishes, or moves to its next candidate name when both found nothing.
 *
 * Addresses from either query make the answer. NXDOMAIN names the name,
 * not a type, so NXDOMAIN from either query with the other reaching no server
 * or breaking its CNAME chain sends the search to its next candidate, keeping
 * that error as the lookup's if no later candidate answers: a network that
 * drops AAAA queries still finds a name under a later search domain. Without
 * an NXDOMAIN, such an error is the lookup's, since the name may well exist.
 * Otherwise the name has no address: NXDOMAIN from both moves the search on,
 * and NODATA ends it, as musl's resolver does, since the name exists and only
 * lacks the type asked: `DNS_RESOLVE_NOT_FOUND`, even after an earlier
 * candidate left an error to fall back on, as that error stands only when no
 * later candidate answers.
 */
const dnsResolverDone = (r: DnsResolver, q: i32, outcome: i32, nowNanos: i64): void => {
  if (r.state[q] === DNS_Q_UDP || r.state[q] === DNS_Q_TCP) {
    r.pending[q] = DNS_CLOSE
  }
  r.state[q] = DNS_Q_DONE
  r.outcome[q] = outcome
  const l: i32 = q / 2
  const a: i32 = l * 2
  if (r.state[a] !== DNS_Q_DONE || r.state[a + 1] !== DNS_Q_DONE) {
    return
  }
  const v4: i32 = r.outcome[a]
  const v6: i32 = r.outcome[a + 1]
  if (v4 > 0 || v6 > 0) {
    const four: i32 = v4 > 0 ? v4 : 0
    const six: i32 = v6 > 0 ? v6 : 0
    dnsResolverGather(r, l, four, six, true)
    dnsResolverFinish(r, l, four + six)
    return
  }
  let error: i32 = 0
  if (v4 === DNS_RESOLVE_NO_ANSWER || v4 === DNS_RESOLVE_CNAME) {
    error = v4
  } else if (v6 === DNS_RESOLVE_NO_ANSWER || v6 === DNS_RESOLVE_CNAME) {
    error = v6
  }
  const named: boolean = r.nxdomain[a] || r.nxdomain[a + 1]
  if (error !== 0 && !named) {
    dnsResolverFinish(r, l, error)
    return
  }
  if (error === 0 && !(r.nxdomain[a] && r.nxdomain[a + 1])) {
    // NODATA answers for the name, so an earlier candidate's fallback does not stand.
    dnsResolverFinish(r, l, DNS_RESOLVE_NOT_FOUND)
    return
  }
  if (error !== 0 && r.fallback[l] === 0) {
    r.fallback[l] = error
  }
  r.candidate[l] = r.candidate[l] + 1
  if (dnsResolverNextCandidate(r, l, nowNanos)) {
    return
  }
  dnsResolverFinish(r, l, r.fallback[l] !== 0 ? r.fallback[l] : DNS_RESOLVE_NOT_FOUND)
}
