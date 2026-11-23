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
// One query's addresses and one lookup's, in bytes: module constants fold
// where a product of the imported ones written inline would not.
const DNS_RESOLVER_ANSWER_BYTES: i32 = DNS_MAX_ANSWERS * DNS_ADDRESS_BYTES
const DNS_RESOLVER_LOOKUP_BYTES: i32 = DNS_RESOLVE_MAX_ADDRESSES * DNS_ADDRESS_BYTES

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
    // The guard above holds `maxLookups` to 1 to 64, so both conversions are
    // exact; as `u16`s the array lengths below are known to be non-negative.
    const lookups: u16 = toU16(maxLookups)
    const n: u16 = toU16(toI32(lookups) * 2)
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
    while (q < toI32(n)) {
      this.queries.push(new Array<u8>(DNS_QUERY_MAX_BYTES))
      this.names.push(new Array<u8>(DNS_MAX_NAME_BYTES))
      this.starts.push(new Array<u8>(DNS_MAX_NAME_BYTES))
      this.streams.push(new Array<u8>(DNS_TCP_MAX_REPLY))
      this.answers.push(new Array<u8>(DNS_RESOLVER_ANSWER_BYTES))
      this.answerTtls.push(new Array<i32>(DNS_MAX_ANSWERS))
      q += 1
    }
    let l: i32 = 0
    while (l < toI32(lookups)) {
      this.bases.push(new Array<u8>(DNS_MAX_NAME_BYTES))
      this.lookupAddresses.push(new Array<u8>(DNS_RESOLVER_LOOKUP_BYTES))
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
    this.baseLength = new Array<i32>(lookups)
    this.nxdomain = new Array<boolean>(n)
    this.absolute = new Array<boolean>(lookups)
    this.candidate = new Array<i32>(lookups)
    this.candidates = new Array<i32>(lookups)
    this.fallback = new Array<i32>(lookups)
    this.dots = new Array<i32>(lookups)
    this.lookupState = new Array<i32>(lookups)
    this.lookupResult = new Array<i32>(lookups)
    this.lookupPort = new Array<i32>(lookups)
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
    const lookupState: i32[] = this.lookupState
    let l: i32 = 0
    while (l < this.maxLookups && l < toI32(lookupState.length) && lookupState[l] !== DNS_L_FREE) {
      l += 1
    }
    // There are `maxLookups` slots, at most 64, so `l > 63` never holds; it
    // bounds `l * 2` for the panic prover. `result`, `cancel` and `settle`
    // take a slot below both bounds, so `start` hands out no other.
    if (l >= this.maxLookups || l >= toI32(lookupState.length) || l > 63) {
      return DNS_RESOLVE_BUSY
    }
    const a: i32 = l * 2
    const state: i32[] = this.state
    const answers: u8[][] = this.answers
    const lookupAddresses: u8[][] = this.lookupAddresses
    const lookupTtls: i32[][] = this.lookupTtls
    const bases: u8[][] = this.bases
    // Each per-query array holds two entries per slot and each per-lookup one
    // holds one, so no part of this holds.
    if (
      a >= toI32(state.length) - 1 ||
      a >= toI32(answers.length) - 1 ||
      l >= toI32(lookupAddresses.length) ||
      l >= toI32(lookupTtls.length) ||
      l >= toI32(bases.length)
    ) {
      return DNS_RESOLVE_BUSY
    }
    state[a] = DNS_Q_IDLE
    state[a + 1] = DNS_Q_IDLE
    const at: u8[] = lookupAddresses[l]
    const ttls: i32[] = lookupTtls[l]
    const base: u8[] = bases[l]
    const four: u8[] = answers[a]
    const six: u8[] = answers[a + 1]
    if (dnsResolverIsLocalhost(name)) {
      dnsResolverLoopback(at, port)
      dnsResolverZeroTtls(ttls, 2)
      return dnsResolverFinishNow(this, l, 2)
    }
    const scratch: u8[] = this.scratch
    if (dnsResolverLiteral(scratch, name, at, port)) {
      dnsResolverZeroTtls(ttls, 1)
      return dnsResolverFinishNow(this, l, 1)
    }
    const built: i32 = dnsBuildQuery(scratch, 0, name, DNS_TYPE_A)
    if (built < 0) {
      return built
    }
    const hosts: DnsHosts | null = this.hosts
    if (hosts !== null) {
      const v4: i32 = dnsHostsFind(hosts, name, DNS_TYPE_A, port, four, DNS_MAX_ANSWERS)
      const v6: i32 = dnsHostsFind(hosts, name, DNS_TYPE_AAAA, port, six, DNS_MAX_ANSWERS)
      // dnsHostsFind answers 0 to its `max`, DNS_MAX_ANSWERS (8).
      if (v4 >= 0 && v4 <= 8 && v6 >= 0 && v6 <= 8 && v4 + v6 > 0) {
        dnsResolverGather(this, l, v4, v6, false)
        return dnsResolverFinishNow(this, l, v4 + v6)
      }
    }
    // The wire name is the query's bytes after the header, less the root byte
    // and the question's type and class.
    const baseLength: i32 = built - 12 - 5
    let i: i32 = 0
    let dots: i32 = 0
    while (i < baseLength && i < toI32(base.length) && i < toI32(scratch.length) - 12) {
      base[i] = scratch[12 + i]
      i += 1
    }
    // Every length byte past the first is a dot of the name. A wire name is
    // at most 255 bytes, which `base` holds, so `p < 256` and `dots < 255`
    // never stop the walk; they bound it for the panic prover.
    let p: i32 = 0
    while (p >= 0 && p < baseLength && p < toI32(base.length) && p < 256) {
      p += toI32(base[p]) + 1
      if (p < baseLength && dots < 255) {
        dots += 1
      }
    }
    const nameLength: i32 = toI32(name.length)
    const absolute: boolean = nameLength > 0 && toI32(name.charCodeAt(nameLength - 1)) === 46
    const baseLengths: i32[] = this.baseLength
    const absolutes: boolean[] = this.absolute
    const dotCounts: i32[] = this.dots
    const candidate: i32[] = this.candidate
    const fallback: i32[] = this.fallback
    const candidates: i32[] = this.candidates
    const lookupPort: i32[] = this.lookupPort
    const lookupResult: i32[] = this.lookupResult
    if (
      l >= toI32(baseLengths.length) ||
      l >= toI32(absolutes.length) ||
      l >= toI32(dotCounts.length) ||
      l >= toI32(candidate.length) ||
      l >= toI32(fallback.length) ||
      l >= toI32(candidates.length) ||
      l >= toI32(lookupPort.length) ||
      l >= toI32(lookupState.length) ||
      l >= toI32(lookupResult.length)
    ) {
      return DNS_RESOLVE_BUSY
    }
    baseLengths[l] = baseLength
    absolutes[l] = absolute
    dotCounts[l] = dots
    candidate[l] = 0
    fallback[l] = 0
    candidates[l] = absolute ? 1 : dnsResolverCount(this.config.searchCount)
    lookupPort[l] = port
    lookupState[l] = DNS_L_RUNNING
    lookupResult[l] = DNS_RESOLVE_PENDING
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
    // Queries take turns: the first owed one from the cursor on, then from 0.
    const pending: i32[] = this.pending
    const n: i32 = toI32(pending.length)
    const cursor: i32 = this.cursor
    let q: i32 = dnsResolverFirstPending(pending, cursor, n)
    if (q < 0) {
      q = dnsResolverFirstPending(pending, 0, cursor)
    }
    const queries: u8[][] = this.queries
    const queryLength: i32[] = this.queryLength
    const server: i32[] = this.server
    // Every per-query array has the same length, so only `q < 0` (nothing
    // owed) takes this.
    if (
      q < 0 ||
      q >= n ||
      q >= toI32(queries.length) ||
      q >= toI32(queryLength.length) ||
      q >= toI32(server.length)
    ) {
      return -1
    }
    const kind: i32 = pending[q]
    pending[q] = 0
    this.cursor = q + 1 < n ? q + 1 : 0
    meta[0] = kind
    meta[1] = 0
    if (kind === DNS_CLOSE) {
      return q
    }
    const query: u8[] = queries[q]
    setU16BE(query, 0, toU16(id))
    const length: i32 = queryLength[q]
    const skip: i32 = kind === DNS_SEND_TCP ? 2 : 0
    if (skip === 2) {
      setU16BE(out, 0, toU16(length))
    }
    // A query's length is at most its buffer's, and `out` holds the longest
    // with its two-byte prefix, so `o` ends at `skip + length`.
    let i: i32 = 0
    let o: i32 = skip
    while (i < length && i < toI32(query.length) && o >= 0 && o < toI32(out.length)) {
      out[o] = query[i]
      i += 1
      o += 1
    }
    meta[1] = o
    dnsResolverServerAddress(this.config.servers, server[q], to)
    this.sent = dnsResolverCount(this.sent)
    return q
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
    const state: i32[] = this.state
    const server: i32[] = this.server
    const queries: u8[][] = this.queries
    const queryLength: i32[] = this.queryLength
    const lookupPort: i32[] = this.lookupPort
    const l: i32 = q / 2
    // The check above holds `q` to a query, and every per-query array (and
    // per-lookup one, by `q / 2`) is that long, so this never returns.
    if (
      q < 0 ||
      q >= toI32(state.length) ||
      q >= toI32(server.length) ||
      q >= toI32(queries.length) ||
      q >= toI32(queryLength.length) ||
      l < 0 ||
      l >= toI32(lookupPort.length)
    ) {
      return
    }
    if (state[q] !== DNS_Q_UDP) {
      this.droppedMalformed = dnsResolverCount(this.droppedMalformed)
      return
    }
    if (!dnsResolverSameServer(this.config.servers, server[q], from)) {
      this.droppedSource = dnsResolverCount(this.droppedSource)
      return
    }
    const status: i32 = dnsParseReply(buf, len, queries[q], queryLength[q], lookupPort[l], this.reply)
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
    const state: i32[] = this.state
    const streams: u8[][] = this.streams
    const streamHave: i32[] = this.streamHave
    const streamWant: i32[] = this.streamWant
    const queries: u8[][] = this.queries
    const queryLength: i32[] = this.queryLength
    const lookupPort: i32[] = this.lookupPort
    const l: i32 = q / 2
    // The check above holds `q` to a query, and every per-query array (and
    // per-lookup one, by `q / 2`) is that long, so this never returns.
    if (
      q < 0 ||
      q >= toI32(state.length) ||
      q >= toI32(streams.length) ||
      q >= toI32(streamHave.length) ||
      q >= toI32(streamWant.length) ||
      q >= toI32(queries.length) ||
      q >= toI32(queryLength.length) ||
      l < 0 ||
      l >= toI32(lookupPort.length)
    ) {
      return
    }
    if (state[q] !== DNS_Q_TCP) {
      return
    }
    const stream: u8[] = streams[q]
    let have: i32 = streamHave[q]
    let want: i32 = streamWant[q]
    let i: i32 = 0
    while (i < len && i < toI32(buf.length)) {
      if (have < 2) {
        want = (want << 8) | toI32(buf[i])
        if (have === 1 && (want < 12 || want > DNS_TCP_MAX_REPLY)) {
          streamHave[q] = have
          streamWant[q] = want
          dnsResolverServerFailed(this, q, nowNanos)
          return
        }
      } else {
        // `want` passed the check above, so the stream, DNS_TCP_MAX_REPLY
        // bytes, holds every byte below it.
        const at: i32 = have - 2
        if (at < want && at < toI32(stream.length)) {
          stream[at] = buf[i]
        }
      }
      // Held at the i32 maximum: past the reply's length a byte only counts.
      have = dnsResolverCount(have)
      i += 1
    }
    streamHave[q] = have
    streamWant[q] = want
    if (have < 2 || have - 2 < want) {
      return
    }
    const status: i32 = dnsParseReply(stream, want, queries[q], queryLength[q], lookupPort[l], this.reply)
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
    const state: i32[] = this.state
    // The check above holds `q` to a query, so `q` is always in `state`.
    if (q >= 0 && q < toI32(state.length) && (state[q] === DNS_Q_UDP || state[q] === DNS_Q_TCP)) {
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
    const state: i32[] = this.state
    const deadline: i64[] = this.deadline
    let q: i32 = 0
    while (q < toI32(state.length) && q < toI32(deadline.length)) {
      if ((state[q] === DNS_Q_UDP || state[q] === DNS_Q_TCP) && deadline[q] <= nowNanos) {
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
    const state: i32[] = this.state
    const deadline: i64[] = this.deadline
    let soonest: i64 = -1
    let q: i32 = 0
    while (q < toI32(state.length) && q < toI32(deadline.length)) {
      if ((state[q] === DNS_Q_UDP || state[q] === DNS_Q_TCP) && (soonest < 0 || deadline[q] < soonest)) {
        soonest = deadline[q]
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
    const lookupState: i32[] = this.lookupState
    // `lookupState` holds `maxLookups` slots, at most 64, so the last two
    // tests add nothing; they bound `lookup` for the panic prover.
    if (
      lookup < 0 ||
      lookup >= this.maxLookups ||
      lookup >= toI32(lookupState.length) ||
      lookup > 63 ||
      lookupState[lookup] === DNS_L_FREE
    ) {
      panic(`DnsResolver.result: ${lookup} is not a lookup in progress`)
    }
    if (
      toI32(out.length) < DNS_RESOLVE_MAX_ADDRESSES * DNS_ADDRESS_BYTES ||
      toI32(ttls.length) < DNS_RESOLVE_MAX_ADDRESSES
    ) {
      panic("DnsResolver.result: out or ttls has no room for DNS_RESOLVE_MAX_ADDRESSES")
    }
    if (lookupState[lookup] !== DNS_L_DONE) {
      return DNS_RESOLVE_PENDING
    }
    const lookupResult: i32[] = this.lookupResult
    const lookupAddresses: u8[][] = this.lookupAddresses
    const lookupTtls: i32[][] = this.lookupTtls
    // Every per-lookup array holds `maxLookups` slots, so this never returns.
    if (
      lookup >= toI32(lookupResult.length) ||
      lookup >= toI32(lookupAddresses.length) ||
      lookup >= toI32(lookupTtls.length)
    ) {
      return DNS_RESOLVE_PENDING
    }
    const count: i32 = lookupResult[lookup]
    const addresses: u8[] = lookupAddresses[lookup]
    const addressTtls: i32[] = lookupTtls[lookup]
    // A count is at most DNS_RESOLVE_MAX_ADDRESSES (16); a code copies nothing.
    let bytes: i32 = 0
    if (count > 0 && count <= 16) {
      bytes = count * DNS_ADDRESS_BYTES
    }
    let i: i32 = 0
    while (i < bytes && i < toI32(out.length) && i < toI32(addresses.length)) {
      out[i] = addresses[i]
      i += 1
    }
    i = 0
    while (i < count && i < toI32(ttls.length) && i < toI32(addressTtls.length)) {
      ttls[i] = addressTtls[i]
      i += 1
    }
    lookupState[lookup] = DNS_L_FREE
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
    const lookupState: i32[] = this.lookupState
    // `lookupState` holds `maxLookups` slots, at most 64, so the last two
    // tests add nothing; they bound `lookup` for the panic prover.
    if (
      lookup < 0 ||
      lookup >= this.maxLookups ||
      lookup >= toI32(lookupState.length) ||
      lookup > 63 ||
      lookupState[lookup] === DNS_L_FREE
    ) {
      panic(`DnsResolver.cancel: ${lookup} is not a lookup in progress`)
    }
    dnsResolverStop(this, lookup * 2)
    dnsResolverStop(this, lookup * 2 + 1)
    lookupState[lookup] = DNS_L_FREE
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
    const lookupState: i32[] = this.lookupState
    // `lookupState` holds `maxLookups` slots, at most 64, so the last two
    // tests add nothing; they bound `lookup` for the panic prover.
    if (
      lookup < 0 ||
      lookup >= this.maxLookups ||
      lookup >= toI32(lookupState.length) ||
      lookup > 63 ||
      lookupState[lookup] === DNS_L_FREE
    ) {
      panic(`DnsResolver.settle: ${lookup} is not a lookup in progress`)
    }
    if (lookupState[lookup] === DNS_L_DONE) {
      return true
    }
    const a: i32 = lookup * 2
    const state: i32[] = this.state
    const outcome: i32[] = this.outcome
    // Each lookup has two queries in both, so this never returns.
    if (a >= toI32(state.length) - 1 || a >= toI32(outcome.length) - 1) {
      return false
    }
    let open: i32 = -1
    if (state[a] === DNS_Q_DONE && outcome[a] > 0) {
      open = a + 1
    } else if (state[a + 1] === DNS_Q_DONE && outcome[a + 1] > 0) {
      open = a
    }
    if (open < 0 || open >= toI32(state.length) || state[open] === DNS_Q_DONE) {
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
    const lookupState: i32[] = this.lookupState
    let count: i32 = 0
    let l: i32 = 0
    while (l < toI32(lookupState.length)) {
      if (lookupState[l] !== DNS_L_FREE) {
        count = dnsResolverCount(count)
      }
      l += 1
    }
    return count
  }
}

/** Panics unless `q` names one of `r`'s queries. */
const dnsResolverCheckQuery = (r: DnsResolver, q: i32, who: string): void => {
  // `q / 2 >= maxLookups` is `q >= 2 * maxLookups` without the product.
  if (q < 0 || q / 2 >= r.maxLookups) {
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
  // `n` is at least 9 and at most the name's length, so `at` stays in it.
  let at: i32 = n - 9
  let i: i32 = 0
  while (i < 9 && i < toI32(word.length)) {
    if (at < 0 || at >= toI32(name.length)) {
      return false
    }
    let b: i32 = toI32(name.charCodeAt(at))
    if (b >= 65 && b <= 90) {
      b += 32
    }
    if (b !== toI32(word.charCodeAt(i))) {
      return false
    }
    i += 1
    at += 1
  }
  return true
}

/** Writes 127.0.0.1 then ::1, both with `port`, to `out`. */
const dnsResolverLoopback = (out: u8[], port: i32): void => {
  // `out` is a lookup's answer, DNS_RESOLVE_MAX_ADDRESSES addresses long, so
  // it always holds the two (36 bytes).
  if (toI32(out.length) < 36) {
    return
  }
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

/**
 * The first query from `from` up to `to` with an action owed, or -1 when there
 * is none.
 */
const dnsResolverFirstPending = (pending: i32[], from: i32, to: i32): i32 => {
  let q: i32 = from < 0 ? 0 : from
  while (q >= 0 && q < to && q < toI32(pending.length)) {
    if (pending[q] !== 0) {
      return q
    }
    q += 1
  }
  return -1
}

/**
 * Copies server `s`'s 18-byte address from `servers` to `to`. A resolver's
 * server is always one `servers` holds, at most `DNS_MAX_SERVERS` (3), so the
 * `s > 2` that would copy nothing never holds; it bounds the offset.
 */
const dnsResolverServerAddress = (servers: u8[], s: i32, to: u8[]): void => {
  if (s < 0 || s > 2) {
    return
  }
  let at: i32 = s * DNS_ADDRESS_BYTES
  let i: i32 = 0
  while (i < DNS_ADDRESS_BYTES && i < toI32(to.length) && at < toI32(servers.length)) {
    to[i] = servers[at]
    i += 1
    at += 1
  }
}

/**
 * Whether `from` is server `s`'s 18-byte address in `servers`. A resolver's
 * server is always one `servers` holds, at most `DNS_MAX_SERVERS` (3), so
 * `s > 2` never holds; it bounds the offset.
 */
const dnsResolverSameServer = (servers: u8[], s: i32, from: u8[]): boolean => {
  if (s < 0 || s > 2) {
    return false
  }
  let at: i32 = s * DNS_ADDRESS_BYTES
  let i: i32 = 0
  while (i < DNS_ADDRESS_BYTES && i < toI32(from.length)) {
    if (at < 0 || at >= toI32(servers.length) || from[i] !== servers[at]) {
      return false
    }
    i += 1
    at += 1
  }
  return true
}

/** Zeroes the first `count` TTLs of `ttls`: an answer that needed no packet. */
const dnsResolverZeroTtls = (ttls: i32[], count: i32): void => {
  let i: i32 = 0
  while (i < count && i < toI32(ttls.length)) {
    ttls[i] = 0
    i += 1
  }
}

/** Finishes lookup `l` before any query was sent, with `count` addresses already in place. */
const dnsResolverFinishNow = (r: DnsResolver, l: i32, count: i32): i32 => {
  dnsResolverSetResult(r, l, count)
  return l
}

/** Ends lookup `l` with `result`, and owes the driver a close for each of its queries still holding a socket. */
const dnsResolverFinish = (r: DnsResolver, l: i32, result: i32): void => {
  // A lookup is below maxLookups, at most 64, so `l > 63` never holds; it
  // bounds `l * 2`.
  if (l >= 0 && l <= 63) {
    dnsResolverStop(r, l * 2)
    dnsResolverStop(r, l * 2 + 1)
  }
  dnsResolverSetResult(r, l, result)
}

/** Marks lookup `l` done with `result`; every lookup is in both arrays. */
const dnsResolverSetResult = (r: DnsResolver, l: i32, result: i32): void => {
  const lookupState: i32[] = r.lookupState
  const lookupResult: i32[] = r.lookupResult
  if (l >= 0 && l < toI32(lookupState.length) && l < toI32(lookupResult.length)) {
    lookupState[l] = DNS_L_DONE
    lookupResult[l] = result
  }
}

/** Stops query `q`, and owes the driver a close if a socket may be open for it. */
const dnsResolverStop = (r: DnsResolver, q: i32): void => {
  const state: i32[] = r.state
  const pending: i32[] = r.pending
  // Every query is in both, so this never returns.
  if (q < 0 || q >= toI32(state.length) || q >= toI32(pending.length)) {
    return
  }
  if (state[q] === DNS_Q_UDP || state[q] === DNS_Q_TCP || pending[q] !== 0) {
    pending[q] = DNS_CLOSE
  }
  if (state[q] !== DNS_Q_IDLE) {
    state[q] = DNS_Q_DONE
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
  const lookupAddresses: u8[][] = r.lookupAddresses
  const lookupTtls: i32[][] = r.lookupTtls
  const answers: u8[][] = r.answers
  const answerTtls: i32[][] = r.answerTtls
  // A lookup is below maxLookups, at most 64, and has two queries in each
  // per-query array, so this never returns.
  if (
    l < 0 ||
    l > 63 ||
    l >= toI32(lookupAddresses.length) ||
    l >= toI32(lookupTtls.length) ||
    l * 2 >= toI32(answers.length) - 1 ||
    l * 2 >= toI32(answerTtls.length) - 1
  ) {
    return
  }
  const out: u8[] = lookupAddresses[l]
  const ttls: i32[] = lookupTtls[l]
  let k: i32 = 0
  let half: i32 = 0
  while (half < 2) {
    const q: i32 = l * 2 + half
    if (q >= toI32(answers.length) || q >= toI32(answerTtls.length)) {
      return
    }
    const answer: u8[] = answers[q]
    const answerTtl: i32[] = answerTtls[q]
    const count: i32 = half === 0 ? v4 : v6
    let least: i32 = 0
    let j: i32 = 0
    while (fromServer && j < count && j < toI32(answerTtl.length)) {
      const t: i32 = answerTtl[j]
      if (j === 0 || t < least) {
        least = t
      }
      j += 1
    }
    // A query holds at most DNS_MAX_ANSWERS (8) addresses and a lookup
    // DNS_RESOLVE_MAX_ADDRESSES (16), the lengths of `answer` and `out`, so
    // the caps only bound the offsets.
    let i: i32 = 0
    while (i < count && i < 8 && k >= 0 && k < toI32(ttls.length) && k < 16) {
      let b: i32 = 0
      // 18 is DNS_ADDRESS_BYTES, written out so it bounds the offsets.
      while (b < 18) {
        const to: i32 = k * DNS_ADDRESS_BYTES + b
        const from: i32 = i * DNS_ADDRESS_BYTES + b
        if (to < toI32(out.length) && from < toI32(answer.length)) {
          out[to] = answer[from]
        }
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
  const candidate: i32[] = r.candidate
  const candidates: i32[] = r.candidates
  const absolute: boolean[] = r.absolute
  const dots: i32[] = r.dots
  const names: u8[][] = r.names
  // A lookup is below maxLookups, at most 64, with its two queries in
  // `names`, so this never returns.
  if (
    l < 0 ||
    l > 63 ||
    l >= toI32(candidate.length) ||
    l >= toI32(candidates.length) ||
    l >= toI32(absolute.length) ||
    l >= toI32(dots.length) ||
    l * 2 >= toI32(names.length) - 1
  ) {
    return false
  }
  const a: i32 = l * 2
  while (candidate[l] < candidates[l]) {
    const c: i32 = candidate[l]
    const search: i32 = r.config.searchCount
    let suffix: i32 = -1
    if (!absolute[l]) {
      if (dots[l] >= r.config.ndots) {
        // Any negative suffix is no suffix, so `c` 0 or below gives -1.
        if (c > 0) {
          suffix = c - 1
        }
      } else {
        suffix = c < search ? c : -1
      }
    }
    // As above: never taken.
    if (a >= toI32(names.length) - 1) {
      return false
    }
    const first: u8[] = names[a]
    const length: i32 = dnsResolverCandidate(r, l, suffix, first)
    if (length > 0) {
      dnsResolverBegin(r, a, length, DNS_TYPE_A, nowNanos)
      const second: u8[] = names[a + 1]
      let i: i32 = 0
      while (i < length && i < toI32(second.length) && i < toI32(first.length)) {
        second[i] = first[i]
        i += 1
      }
      dnsResolverBegin(r, a + 1, length, DNS_TYPE_AAAA, nowNanos)
      return true
    }
    candidate[l] = dnsResolverCount(c)
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
  const bases: u8[][] = r.bases
  const baseLengths: i32[] = r.baseLength
  // Every lookup has a base, and `start` keeps its length under 255, so
  // this never returns.
  if (l < 0 || l >= toI32(bases.length) || l >= toI32(baseLengths.length)) {
    return 0
  }
  const base: u8[] = bases[l]
  let n: i32 = baseLengths[l]
  if (n < 0 || n > 255) {
    return 0
  }
  let i: i32 = 0
  while (i < n && i < toI32(out.length) && i < toI32(base.length)) {
    out[i] = base[i]
    i += 1
  }
  if (suffix >= 0) {
    const starts: i32[] = r.config.searchStart
    const lengths: i32[] = r.config.searchLength
    const search: u8[] = r.config.search
    // A suffix is one of the config's domains, inside its 256-byte
    // DNS_MAX_SEARCH_BYTES buffer, so this never returns.
    if (suffix >= toI32(starts.length) || suffix >= toI32(lengths.length)) {
      return 0
    }
    const start: i32 = starts[suffix]
    const length: i32 = lengths[suffix]
    if (start < 0 || start > 256 || length < 0 || length > 256) {
      return 0
    }
    // The suffix's text becomes labels: each dot, and its end, closes the
    // label whose length byte sits at `n`. The caps 63 (DNS_MAX_LABEL_BYTES)
    // and 255 or 252 (from DNS_MAX_NAME_BYTES) are written out so they bound
    // the offsets; each only restates the test beside it.
    let label: i32 = 0
    let k: i32 = 0
    while (k <= length) {
      let b: i32 = 46
      if (k < length) {
        const at: i32 = start + k
        if (at >= toI32(search.length)) {
          return 0
        }
        b = toI32(search[at])
      }
      if (b === 46) {
        if (label === 0 || label > 63 || n < 0 || n > 255 || n >= toI32(out.length)) {
          return 0
        }
        out[n] = toU8(label)
        n += label + 1
        label = 0
      } else if (
        b < 33 ||
        b > 126 ||
        n < 0 ||
        n > 252 ||
        label < 0 ||
        label > 252 ||
        n + 1 + label > DNS_MAX_NAME_BYTES - 2
      ) {
        return 0
      } else {
        const at: i32 = n + 1 + label
        if (at >= toI32(out.length)) {
          return 0
        }
        out[at] = toU8(b)
        label += 1
      }
      k += 1
    }
  }
  // `n > 254` is `n + 1 > DNS_MAX_NAME_BYTES`; `out` holds 255 bytes.
  if (n < 0 || n > 254 || n >= toI32(out.length)) {
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
  const hops: i32[] = r.hops
  const nameLength: i32[] = r.nameLength
  const names: u8[][] = r.names
  const starts: u8[][] = r.starts
  // A query is below 2 * maxLookups, these arrays' length, so this never returns.
  if (
    q < 0 ||
    q >= toI32(hops.length) ||
    q >= toI32(nameLength.length) ||
    q >= toI32(names.length) ||
    q >= toI32(starts.length)
  ) {
    return
  }
  hops[q] = 0
  nameLength[q] = length
  const name: u8[] = names[q]
  const start: u8[] = starts[q]
  // Both hold 255 bytes, and a candidate name is at most that long.
  let i: i32 = 0
  while (i < length && i < toI32(name.length) && i < toI32(start.length)) {
    const b: i32 = toI32(name[i])
    start[i] = toU8(b >= 65 && b <= 90 ? b + 32 : b)
    i += 1
  }
  dnsResolverAsk(r, q, qtype, nowNanos)
}

/** Writes query `q`'s bytes for its current name and `qtype`, ID 0 until it is sent, and sends it to the first server. */
const dnsResolverAsk = (r: DnsResolver, q: i32, qtype: i32, nowNanos: i64): void => {
  const queries: u8[][] = r.queries
  const names: u8[][] = r.names
  const nameLength: i32[] = r.nameLength
  const queryLength: i32[] = r.queryLength
  const nxdomain: boolean[] = r.nxdomain
  const server: i32[] = r.server
  const round: i32[] = r.round
  // As in dnsResolverBegin: never taken.
  if (
    q < 0 ||
    q >= toI32(queries.length) ||
    q >= toI32(names.length) ||
    q >= toI32(nameLength.length) ||
    q >= toI32(queryLength.length) ||
    q >= toI32(nxdomain.length) ||
    q >= toI32(server.length) ||
    q >= toI32(round.length)
  ) {
    return
  }
  const query: u8[] = queries[q]
  const name: u8[] = names[q]
  const length: i32 = nameLength[q]
  // `255` is DNS_MAX_NAME_BYTES: every name written to `names` fits it, so this never returns.
  if (length < 0 || length > 255) {
    return
  }
  // The bytes are dnsBuildQuery's: the ID, RD, one question, then the name, type and class IN.
  setU16BE(query, 0, toU16(0))
  setU16BE(query, 2, toU16(0x0100))
  setU16BE(query, 4, toU16(1))
  setU16BE(query, 6, toU16(0))
  setU16BE(query, 8, toU16(0))
  setU16BE(query, 10, toU16(0))
  let i: i32 = 0
  let o: i32 = 12
  while (i < length && i < toI32(name.length) && o >= 0 && o < toI32(query.length)) {
    query[o] = name[i]
    i += 1
    o += 1
  }
  setU16BE(query, 12 + length, toU16(qtype))
  setU16BE(query, 14 + length, toU16(1))
  queryLength[q] = 16 + length
  // Only this name's reply may say NXDOMAIN, not an earlier candidate's or lookup's.
  nxdomain[q] = false
  server[q] = 0
  round[q] = 0
  dnsResolverSend(r, q, DNS_Q_UDP, nowNanos)
}

/** Owes the driver a send of query `q` to its current server over `how`, with a deadline `timeout` seconds after `nowNanos`. */
const dnsResolverSend = (r: DnsResolver, q: i32, how: i32, nowNanos: i64): void => {
  const state: i32[] = r.state
  const pending: i32[] = r.pending
  const streamHave: i32[] = r.streamHave
  const streamWant: i32[] = r.streamWant
  const deadline: i64[] = r.deadline
  // As in dnsResolverBegin: never taken.
  if (
    q < 0 ||
    q >= toI32(state.length) ||
    q >= toI32(pending.length) ||
    q >= toI32(streamHave.length) ||
    q >= toI32(streamWant.length) ||
    q >= toI32(deadline.length)
  ) {
    return
  }
  state[q] = how
  pending[q] = how === DNS_Q_TCP ? DNS_SEND_TCP : DNS_SEND_UDP
  streamHave[q] = 0
  streamWant[q] = 0
  deadline[q] = dnsResolverDeadline(nowNanos, r.config.timeout)
}

/** 2^62 - 1 nanoseconds, about 146 years: as far from 0 as a clock `dnsResolverDeadline` adds to. */
const DNS_RESOLVER_FAR: i64 = 1073741824 * 4294967296 - 1

/** The last nanosecond an `i64` clock holds, 2^63 - 1: a deadline no clock reaches. */
const DNS_RESOLVER_NEVER: i64 = DNS_RESOLVER_FAR * 2 + 1

/**
 * `timeout` seconds after `nowNanos`. `timeout * 10^9` is below 2^62 from 0
 * for any `i32`, so the sum fits wherever `nowNanos` is within 2^62 of 0,
 * which the masks below say without changing it. A clock later than that
 * gives `DNS_RESOLVER_NEVER`, a deadline no clock reaches, and one earlier,
 * which no monotonic clock reads, gives itself: a deadline already passed.
 */
const dnsResolverDeadline = (nowNanos: i64, timeout: i32): i64 => {
  if (nowNanos > DNS_RESOLVER_FAR) {
    return DNS_RESOLVER_NEVER
  }
  if (nowNanos >= 0) {
    return (nowNanos & DNS_RESOLVER_FAR) + toI64(timeout) * 1000000000
  }
  if (nowNanos < -DNS_RESOLVER_FAR - 1) {
    return nowNanos
  }
  // `-1 - nowNanos` is `nowNanos`'s bitwise complement, at most 2^62 - 1 here, so the mask keeps it.
  return toI64(timeout) * 1000000000 - ((-1 - nowNanos) & DNS_RESOLVER_FAR) - 1
}

/**
 * Query `q`'s try failed: it moves to the next server, and after the last
 * server to the next round, and after `attempts` rounds it is
 * `DNS_RESOLVE_NO_ANSWER`.
 */
const dnsResolverServerFailed = (r: DnsResolver, q: i32, nowNanos: i64): void => {
  r.serverFailures = dnsResolverCount(r.serverFailures)
  const server: i32[] = r.server
  const round: i32[] = r.round
  // As in dnsResolverBegin: never taken.
  if (q < 0 || q >= toI32(server.length) || q >= toI32(round.length)) {
    return
  }
  // A server is below serverCount and a round below attempts, so the counts never saturate.
  server[q] = dnsResolverCount(server[q])
  if (server[q] >= r.config.serverCount) {
    server[q] = 0
    round[q] = dnsResolverCount(round[q])
  }
  if (round[q] >= r.config.attempts) {
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
  const nxdomain: boolean[] = r.nxdomain
  const answers: u8[][] = r.answers
  const answerTtls: i32[][] = r.answerTtls
  const hops: i32[] = r.hops
  const names: u8[][] = r.names
  const nameLength: i32[] = r.nameLength
  const starts: u8[][] = r.starts
  // As in dnsResolverBegin: never taken.
  if (
    q < 0 ||
    q >= toI32(nxdomain.length) ||
    q >= toI32(answers.length) ||
    q >= toI32(answerTtls.length) ||
    q >= toI32(hops.length) ||
    q >= toI32(names.length) ||
    q >= toI32(nameLength.length) ||
    q >= toI32(starts.length)
  ) {
    return
  }
  nxdomain[q] = status === DNS_NXDOMAIN
  if (status === DNS_NXDOMAIN) {
    dnsResolverDone(r, q, DNS_RESOLVE_NOT_FOUND, nowNanos)
    return
  }
  if (status !== DNS_NOERROR) {
    dnsResolverServerFailed(r, q, nowNanos)
    return
  }
  const count: i32 = reply.count
  if (count > 0) {
    const answer: u8[] = answers[q]
    const addresses: u8[] = reply.addresses
    // `i / 18 < count` is `i < count * DNS_ADDRESS_BYTES` without the product;
    // both arrays hold DNS_MAX_ANSWERS addresses, as many as a reply counts.
    let i: i32 = 0
    while (i < toI32(answer.length) && i < toI32(addresses.length) && i / 18 < count) {
      answer[i] = addresses[i]
      i += 1
    }
    const answerTtl: i32[] = answerTtls[q]
    const ttls: i32[] = reply.ttls
    i = 0
    while (i < count && i < toI32(answerTtl.length) && i < toI32(ttls.length)) {
      answerTtl[i] = ttls[i]
      i += 1
    }
    dnsResolverDone(r, q, count, nowNanos)
    return
  }
  if (dnsResolverSameName(reply.chain, reply.asked)) {
    dnsResolverDone(r, q, DNS_RESOLVE_NOT_FOUND, nowNanos)
    return
  }
  // The chain left the reply without an address: ask for its end.
  if (hops[q] >= DNS_RESOLVER_MAX_CNAME_HOPS || dnsResolverSameName(reply.chain, starts[q])) {
    dnsResolverDone(r, q, DNS_RESOLVE_CNAME, nowNanos)
    return
  }
  hops[q] = dnsResolverCount(hops[q])
  r.cnameQueries = dnsResolverCount(r.cnameQueries)
  const chain: u8[] = reply.chain
  const name: u8[] = names[q]
  const length: i32 = dnsResolverNameLength(chain)
  // `chain` and `name` both hold 255 bytes, and the chain is a name dnsReadName read.
  let i: i32 = 0
  while (i < length && i < toI32(chain.length) && i < toI32(name.length)) {
    name[i] = chain[i]
    i += 1
  }
  nameLength[q] = length
  dnsResolverAsk(r, q, (q & 1) === 0 ? DNS_TYPE_A : DNS_TYPE_AAAA, nowNanos)
}

/** The length of the wire name in `name`, its root byte included, read label by label since a label may hold a 0 byte. */
const dnsResolverNameLength = (name: u8[]): i32 => {
  // `i < 256`: every name here is held in DNS_MAX_NAME_BYTES (255), so `i < name.length` ends the walk first.
  let i: i32 = 0
  let end: i32 = 1
  while (i >= 0 && i < 256 && i < toI32(name.length) && name[i] !== toU8(0)) {
    const next: i32 = i + toI32(name[i]) + 1
    i = next
    end = next + 1
  }
  return end
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
 * lacks the type asked. NODATA is `DNS_RESOLVE_NOT_FOUND` even after an
 * earlier candidate left an error to fall back on: that error stands only
 * when no later candidate answers.
 */
const dnsResolverDone = (r: DnsResolver, q: i32, outcome: i32, nowNanos: i64): void => {
  const state: i32[] = r.state
  const pending: i32[] = r.pending
  const outcomes: i32[] = r.outcome
  const nxdomain: boolean[] = r.nxdomain
  const fallback: i32[] = r.fallback
  const candidate: i32[] = r.candidate
  // A query is below 2 * maxLookups, the per-query arrays' even length, and
  // its lookup below maxLookups, the others', so this never returns.
  if (q < 0 || q >= toI32(state.length) || q >= toI32(pending.length) || q >= toI32(outcomes.length)) {
    return
  }
  if (state[q] === DNS_Q_UDP || state[q] === DNS_Q_TCP) {
    pending[q] = DNS_CLOSE
  }
  state[q] = DNS_Q_DONE
  outcomes[q] = outcome
  const l: i32 = q / 2
  const a: i32 = l * 2
  // As above: never taken.
  if (
    a >= toI32(state.length) - 1 ||
    a >= toI32(outcomes.length) - 1 ||
    a >= toI32(nxdomain.length) - 1 ||
    l >= toI32(fallback.length) ||
    l >= toI32(candidate.length)
  ) {
    return
  }
  if (state[a] !== DNS_Q_DONE || state[a + 1] !== DNS_Q_DONE) {
    return
  }
  const v4: i32 = outcomes[a]
  const v6: i32 = outcomes[a + 1]
  if (v4 > 0 || v6 > 0) {
    const four: i32 = v4 > 0 ? v4 : 0
    const six: i32 = v6 > 0 ? v6 : 0
    // A positive outcome is a reply's address count, at most DNS_MAX_ANSWERS (8): never taken.
    if (four < 0 || four > 8 || six < 0 || six > 8) {
      return
    }
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
  const named: boolean = nxdomain[a] || nxdomain[a + 1]
  if (error !== 0 && !named) {
    dnsResolverFinish(r, l, error)
    return
  }
  if (error === 0 && !(nxdomain[a] && nxdomain[a + 1])) {
    // NODATA answers for the name, so an earlier candidate's fallback does not stand.
    dnsResolverFinish(r, l, DNS_RESOLVE_NOT_FOUND)
    return
  }
  if (error !== 0 && fallback[l] === 0) {
    fallback[l] = error
  }
  candidate[l] = dnsResolverCount(candidate[l])
  if (dnsResolverNextCandidate(r, l, nowNanos)) {
    return
  }
  const last: i32 = fallback[l]
  dnsResolverFinish(r, l, last !== 0 ? last : DNS_RESOLVE_NOT_FOUND)
}
