/**
 * `nish/net/dns-message` — a DNS query for one A or AAAA question written into
 * the caller's buffer, and the reply to it read back into addresses.
 *
 * A stub resolver sends one question over UDP and reads whatever datagram
 * comes back to its port, so every byte of a reply is the peer's: a name
 * compressed into a loop, a count of 65,535 answers in a 40-byte message, an A
 * record five bytes long. This module reads a reply against the query it
 * answers and refuses each of those with its own code:
 *
 *     import {
 *       DnsReply, DNS_ADDRESS_BYTES, DNS_NOERROR, DNS_QUERY_MAX_BYTES, DNS_TYPE_A,
 *       dnsBuildQuery, dnsParseReply,
 *     } from "nish/net/dns-message"
 *
 *     const query: u8[] = new Array<u8>(DNS_QUERY_MAX_BYTES)
 *     // A sketch: `id` is a fresh random 16-bit number for each query, and
 *     // `msg` a u8[] the program reads `mlen` bytes of reply into.
 *     const qlen: i32 = dnsBuildQuery(query, id, "example.com", DNS_TYPE_A)   // < 0: a DNS_ERR_* code
 *     // ... send query[0, qlen), read the datagram into msg[0, mlen) ...
 *     const reply: DnsReply = new DnsReply()
 *     const status: i32 = dnsParseReply(msg, mlen, query, qlen, 443, reply)
 *     if (status === DNS_NOERROR && !reply.truncated) {
 *       // reply.addresses[i * DNS_ADDRESS_BYTES, +18) for i < reply.count, each with reply.ttls[i]
 *     } // DNS_NXDOMAIN, DNS_SERVFAIL, DNS_REFUSED: the server's answer; < 0: a DNS_ERR_* code
 *
 * **Nothing is allocated per message.** The query is written into the
 * caller's array and the reply read into a `DnsReply` the caller made once and
 * passes again; `dnsParseReply` resets it first. A window outside its array is
 * a bug in the caller and panics; nothing a peer sends does, and the work is
 * linear in the reply's length.
 *
 * **A reply must answer the query.** Its ID, its QR bit, opcode 0, exactly one
 * question, and that question's name (compared without case, as RFC 4343 asks),
 * type and class must all be the query's, or the reply is refused before any
 * record is read: it is not an answer to this question.
 *
 * **Names are bounded.** A compression pointer must point before the start of
 * the run of labels that holds it, so every hop moves backwards and a loop is
 * impossible; at most `DNS_MAX_POINTER_HOPS` (16) hops are followed, a name
 * is at most 255 bytes in wire form, and the label types RFC 6891 retired
 * (`0x40`, `0x80`) are refused.
 *
 * **Only the question's name is answered.** Records are read in message
 * order, and the chain starts at the question's name: a CNAME whose owner is
 * the chain's end moves the end to its target, and an A or AAAA record of the
 * asked type whose owner is the chain's end is kept. Every other record is
 * read past, so an answer for a name nobody asked about never becomes an
 * address. The first `DNS_MAX_ANSWERS` (8) addresses are kept and the rest
 * counted in `dropped`.
 *
 * **Addresses are the 18-byte form** of `docs/LANGUAGE.md`: sixteen bytes of
 * IPv6, an IPv4 address as `::ffff:a.b.c.d`, then the caller's port big-endian,
 * so one can be handed to a connect as it stands.
 *
 * The record of what this module refuses and why is `docs/security/dns.md`.
 */

/** The record type of an IPv4 address (RFC 1035 §3.2.2). */
export const DNS_TYPE_A: i32 = 1
/** The record type of an alias (RFC 1035 §3.2.2). */
export const DNS_TYPE_CNAME: i32 = 5
/** The record type of an IPv6 address (RFC 3596 §2.1). */
export const DNS_TYPE_AAAA: i32 = 28
/** The Internet class, the only one asked or kept. */
export const DNS_CLASS_IN: i32 = 1

/** The bytes of one address: sixteen of IPv6 and two of port. */
export const DNS_ADDRESS_BYTES: i32 = 18
/** How many addresses one reply keeps; the rest are counted in `DnsReply.dropped`. */
export const DNS_MAX_ANSWERS: i32 = 8
/** How many compression pointers one name may follow. */
export const DNS_MAX_POINTER_HOPS: i32 = 16
/** The longest name in wire form, its root byte included (RFC 1035 §2.3.4). */
export const DNS_MAX_NAME_BYTES: i32 = 255
/** The longest label (RFC 1035 §2.3.4). */
export const DNS_MAX_LABEL_BYTES: i32 = 63
/** The longest query `dnsBuildQuery` writes: the header, the longest name, the type and class. */
export const DNS_QUERY_MAX_BYTES: i32 = 12 + 255 + 4

/** The server answered: the name exists, and its addresses, if any, are in the reply. */
export const DNS_NOERROR: i32 = 0
/** The server could not answer (RCODE 2). */
export const DNS_SERVFAIL: i32 = 2
/** The name does not exist (RCODE 3). */
export const DNS_NXDOMAIN: i32 = 3
/** The server will not answer (RCODE 5). */
export const DNS_REFUSED: i32 = 5

/** `out` has no room for the query; nothing is written past `out.length`. */
export const DNS_ERR_SPACE: i32 = -1
/** The name to ask is empty, or holds an empty label (`a..b`, `.a`). */
export const DNS_ERR_EMPTY_LABEL: i32 = -2
/** A label of the name to ask is longer than 63 bytes. */
export const DNS_ERR_LABEL_LONG: i32 = -3
/** A name is longer than 255 bytes in wire form: the one to ask, or one in the reply. */
export const DNS_ERR_NAME_LONG: i32 = -4
/** The name to ask holds a byte that is not printable ASCII (a control byte, a space, or above 0x7E). */
export const DNS_ERR_NAME_BYTE: i32 = -5
/** The type to ask is not `DNS_TYPE_A` or `DNS_TYPE_AAAA`. */
export const DNS_ERR_QTYPE: i32 = -6
/** The reply is shorter than its 12-byte header. */
export const DNS_ERR_HEADER: i32 = -7
/** The reply's QR bit is clear: it is a query, not a reply. */
export const DNS_ERR_NOT_REPLY: i32 = -8
/** The reply's opcode is not 0 (a standard query). */
export const DNS_ERR_OPCODE: i32 = -9
/** The reply's ID is not the query's. */
export const DNS_ERR_ID: i32 = -10
/** The reply does not hold exactly one question, or not the query's name, type and class. */
export const DNS_ERR_QUESTION: i32 = -11
/** A name or a record's fixed fields run past the end of the reply. */
export const DNS_ERR_SHORT: i32 = -12
/** The reply's counts promise more records than its remaining bytes can hold. */
export const DNS_ERR_COUNT: i32 = -13
/** A compression pointer points at or after the run of labels that holds it, or into the header. */
export const DNS_ERR_POINTER: i32 = -14
/** A name follows more than `DNS_MAX_POINTER_HOPS` compression pointers. */
export const DNS_ERR_HOPS: i32 = -15
/** A label's length byte starts with the bits `01` or `10`, types RFC 6891 retired. */
export const DNS_ERR_LABEL_TYPE: i32 = -16
/** An A record's RDLENGTH is not 4, or an AAAA record's is not 16. */
export const DNS_ERR_RDLENGTH: i32 = -17
/** A record's RDATA runs past the end of the reply, or a CNAME's target does not fill it. */
export const DNS_ERR_RDATA: i32 = -18
/** The reply's RCODE is none of NOERROR, SERVFAIL, NXDOMAIN and REFUSED (FORMERR, NOTIMP, or one undefined). */
export const DNS_ERR_RCODE: i32 = -19

const DNS_HEADER_BYTES: i32 = 12
const DNS_FLAG_QR: i32 = 0x8000
const DNS_FLAG_TC: i32 = 0x0200
const DNS_FLAG_RD: i32 = 0x0100
/** The fewest bytes a record can take: a root name and its ten fixed bytes. */
const DNS_MIN_RECORD_BYTES: i32 = 11
/** `DNS_MAX_ANSWERS` addresses of `DNS_ADDRESS_BYTES` each. */
const DNS_ADDRESS_TABLE_BYTES: i32 = 144

/**
 * One reply read by `dnsParseReply`, made once and reused.
 *
 * The arrays are sized for `DNS_MAX_ANSWERS`, and `owner` and `chain` hold a
 * name each in lowercase wire form, so reading a reply writes only into what
 * the constructor made.
 */
export class DnsReply {
  /** `count` addresses of `DNS_ADDRESS_BYTES` each, from offset 0. */
  addresses: u8[]
  /** The TTL of each kept address, in seconds; one above 2^31 - 1 reads as 0 (RFC 2181 §8). */
  ttls: i32[]
  /** How many addresses were kept. */
  count: i32 = 0
  /** How many addresses past `DNS_MAX_ANSWERS` were read and not kept. */
  dropped: i32 = 0
  /**
   * The reply's RCODE (0 to 15), once the reply was found to answer the query;
   * 0 when it was refused before that.
   */
  rcode: i32 = 0
  /** The TC bit: the reply was cut to fit a datagram, and no record of it was read. */
  truncated: boolean = false
  /**
   * The last record's owner name, lowercase, in wire form.
   * @internal Used by `dnsParseReply` in this module.
   */
  owner: u8[]
  /**
   * The end of the alias chain, lowercase, in wire form: the question's name until a CNAME moves it.
   * @internal Used by `dnsParseReply` in this module; `dnsResolverAnswer` in std/net/dns-resolver.ts.
   */
  chain: u8[]
  /**
   * The question's name as the query asked it, lowercase, in wire form.
   * @internal Used by `dnsParseReply` in this module; `dnsResolverAnswer` in std/net/dns-resolver.ts.
   */
  asked: u8[]

  /**
   * Makes an empty reply with every array sized for `DNS_MAX_ANSWERS` answers
   * and `DNS_MAX_NAME_BYTES`-byte names, for `dnsParseReply` to fill.
   */
  constructor() {
    this.addresses = new Array<u8>(DNS_ADDRESS_TABLE_BYTES)
    this.ttls = new Array<i32>(DNS_MAX_ANSWERS)
    this.owner = new Array<u8>(DNS_MAX_NAME_BYTES)
    this.chain = new Array<u8>(DNS_MAX_NAME_BYTES)
    this.asked = new Array<u8>(DNS_MAX_NAME_BYTES)
  }
}

/** Panics unless `[0, len)` lies inside `bytes`. */
const dnsCheckLength = (bytes: u8[], len: i32, who: string): void => {
  if (len < 0 || len > toI32(bytes.length)) {
    panic(who + ": the length is outside the array")
  }
}

/**
 * The big-endian u16 whose high byte is `hi` and low byte `lo`. The message
 * reads index their bytes in place, where the checks before them prove them,
 * rather than call `getU16BE`, whose window check would need a test after
 * every call before it.
 */
const dnsBe16 = (hi: u8, lo: u8): u16 => (toU16(hi) << 8) | toU16(lo)

/** `b` with A to Z read as a to z, and every other byte as it stands. */
const dnsLower = (b: i32): i32 => (b >= 65 && b <= 90 ? b + 32 : b)

/**
 * Writes the query for `name` and `qtype` into `out` from offset 0: the ID,
 * RD set, one question of class IN, and no EDNS record. Answers the query's
 * length, or a `DNS_ERR_*` code with `out` partly written.
 *
 * `name` is ASCII, its labels split on `.`, and one trailing `.` is read as the
 * root it names. `id` is the caller's: a resolver draws it at random, so that a
 * spoofed reply must guess it, and passes the same query to `dnsParseReply`.
 * Nothing is allocated, and nothing is written past `out.length`.
 *
 * @param out Where the query goes, from offset 0; `DNS_QUERY_MAX_BYTES` (271)
 *   bytes always have room for any name that is one.
 * @param id The query ID, 0 to 0xFFFF; any other value panics.
 * @param name The name to ask, such as `"example.com"` or `"example.com."`:
 *   bytes 33 to 126 (printable ASCII without the space), labels of 1 to 63
 *   bytes, at most 253 bytes without the trailing dot.
 * @param qtype `DNS_TYPE_A` or `DNS_TYPE_AAAA`; any other is `DNS_ERR_QTYPE`.
 * @returns The query's length in bytes, written to `out[0, length)`, or a
 *   negative `DNS_ERR_*` code: `DNS_ERR_QTYPE`, `DNS_ERR_EMPTY_LABEL`,
 *   `DNS_ERR_LABEL_LONG`, `DNS_ERR_NAME_LONG`, `DNS_ERR_NAME_BYTE` or
 *   `DNS_ERR_SPACE`.
 */
export const dnsBuildQuery = (out: u8[], id: i32, name: string, qtype: i32): i32 => {
  if (id < 0 || id > 0xffff) {
    panic(`dnsBuildQuery: the id ${id} is not 16 bits`)
  }
  if (qtype !== DNS_TYPE_A && qtype !== DNS_TYPE_AAAA) {
    return DNS_ERR_QTYPE
  }
  let n: i32 = toI32(name.length)
  if (n > 0 && name.charCodeAt(n - 1) === 46) {
    n -= 1
  }
  if (n === 0) {
    return DNS_ERR_EMPTY_LABEL
  }
  // n bytes of name become n + 1 of labels and one root byte, so n is at most
  // `DNS_MAX_NAME_BYTES - 2`: a literal, which is what bounds the sums below.
  if (n > 253) {
    return DNS_ERR_NAME_LONG
  }
  const total: i32 = DNS_HEADER_BYTES + n + 2 + 4
  if (total > toI32(out.length) || toI32(out.length) < DNS_HEADER_BYTES) {
    return DNS_ERR_SPACE
  }
  // The header's six big-endian u16s, `total` (at least 19) bytes having been
  // checked: ID, flags (RD), QDCOUNT 1 and three zero counts.
  out[0] = toU8(id >> 8)
  out[1] = toU8(id & 255)
  out[2] = toU8(DNS_FLAG_RD >> 8)
  out[3] = toU8(DNS_FLAG_RD & 255)
  out[4] = toU8(0)
  out[5] = toU8(1)
  out[6] = toU8(0)
  out[7] = toU8(0)
  out[8] = toU8(0)
  out[9] = toU8(0)
  out[10] = toU8(0)
  out[11] = toU8(0)
  // The bytes of the label being written so far, held at 64 once it is past
  // `DNS_MAX_LABEL_BYTES`: its length byte goes just before them.
  let label: i32 = 0
  let i: i32 = 0
  while (i <= n) {
    const b: i32 = i < n ? toI32(name.charCodeAt(i)) : 46
    if (b === 46) {
      if (label <= 0) {
        return DNS_ERR_EMPTY_LABEL
      }
      // `DNS_MAX_LABEL_BYTES`.
      if (label > 63) {
        return DNS_ERR_LABEL_LONG
      }
      const lengthAt: i32 = DNS_HEADER_BYTES + i - label
      if (lengthAt < 0 || lengthAt >= toI32(out.length)) {
        return DNS_ERR_SPACE
      }
      out[lengthAt] = toU8(label)
      label = 0
    } else if (b < 33 || b > 126) {
      return DNS_ERR_NAME_BYTE
    } else {
      if (label < 64) {
        label += 1
      }
      // Within `total`, so never past `out.length`.
      const at: i32 = DNS_HEADER_BYTES + i + 1
      if (at >= toI32(out.length)) {
        return DNS_ERR_SPACE
      }
      out[at] = toU8(b)
    }
    i += 1
  }
  const rootAt: i32 = DNS_HEADER_BYTES + n + 1
  if (rootAt >= toI32(out.length)) {
    return DNS_ERR_SPACE
  }
  out[rootAt] = toU8(0)
  // QTYPE then QCLASS IN, the question's last four bytes.
  const typeAt: i32 = rootAt + 1
  if (typeAt > toI32(out.length) - 4) {
    return DNS_ERR_SPACE
  }
  out[typeAt] = toU8(qtype >> 8)
  out[typeAt + 1] = toU8(qtype & 255)
  out[typeAt + 2] = toU8(DNS_CLASS_IN >> 8)
  out[typeAt + 3] = toU8(DNS_CLASS_IN & 255)
  return total
}

/**
 * Reads the name at `msg[off]`, following compression pointers, into `out` in
 * lowercase wire form, and answers the offset just past the name where it
 * stands in the message (past its first pointer, when it has one), or a
 * `DNS_ERR_*` code.
 *
 * A pointer must point before `runStart`, the offset the labels holding it
 * started at, and after the header: each hop then moves strictly backwards,
 * which is what makes a loop impossible rather than merely bounded.
 */
const dnsReadName = (msg: u8[], len: i32, off: i32, out: u8[]): i32 => {
  let pos: i32 = off
  let runStart: i32 = off
  let after: i32 = -1
  let hops: i32 = 0
  let w: i32 = 0
  const msgLen: i32 = toI32(msg.length)
  const outLen: i32 = toI32(out.length)
  while (true) {
    // No DNS message is longer than 65535 bytes (TCP frames it with a 16-bit
    // length, and no datagram is longer), so no name reads past that.
    if (pos < 0 || pos >= len || pos >= msgLen || pos >= 65535) {
      return DNS_ERR_SHORT
    }
    const b: i32 = toI32(msg[pos])
    // The label check below keeps `w` under `DNS_MAX_NAME_BYTES`.
    if (w < 0 || w >= outLen || w >= 255) {
      return DNS_ERR_NAME_LONG
    }
    if (b === 0) {
      out[w] = toU8(0)
      return after >= 0 ? after : pos + 1
    }
    const kind: i32 = b & 0xc0
    if (kind === 0xc0) {
      const low: i32 = pos + 1
      if (low >= len || low >= msgLen) {
        return DNS_ERR_SHORT
      }
      const target: i32 = ((b & 0x3f) << 8) | toI32(msg[low])
      if (target >= runStart || target < DNS_HEADER_BYTES) {
        return DNS_ERR_POINTER
      }
      if (hops >= DNS_MAX_POINTER_HOPS) {
        return DNS_ERR_HOPS
      }
      hops += 1
      if (after < 0) {
        after = pos + 2
      }
      pos = target
      runStart = target
    } else if (kind !== 0) {
      return DNS_ERR_LABEL_TYPE
    } else {
      if (pos + b >= len) {
        return DNS_ERR_SHORT
      }
      // The label, its length byte and the root byte still to come.
      if (w + b + 2 > DNS_MAX_NAME_BYTES) {
        return DNS_ERR_NAME_LONG
      }
      out[w] = toU8(b)
      let k: i32 = 1
      while (k <= b) {
        // `pos + b < len` and `w + b < DNS_MAX_NAME_BYTES` put both in range.
        const from: i32 = pos + k
        if (from >= toI32(msg.length)) {
          return DNS_ERR_SHORT
        }
        const lower: i32 = dnsLower(toI32(msg[from]))
        const to: i32 = w + k
        if (to >= toI32(out.length)) {
          return DNS_ERR_NAME_LONG
        }
        out[to] = toU8(lower)
        k += 1
      }
      w += b + 1
      pos += b + 1
    }
  }
}

/** Whether two names `dnsReadName` wrote are the same name. */
const dnsSameName = (a: u8[], b: u8[]): boolean => {
  let i: i32 = 0
  const aLen: i32 = toI32(a.length)
  const bLen: i32 = toI32(b.length)
  while (true) {
    // Neither name is longer than `DNS_MAX_NAME_BYTES` (255).
    if (i < 0 || i >= aLen || i >= bLen || i >= 255) {
      return false
    }
    const n: i32 = toI32(a[i])
    if (n !== toI32(b[i])) {
      return false
    }
    if (n === 0) {
      return true
    }
    let k: i32 = 1
    while (k <= n) {
      const at: i32 = i + k
      if (at >= aLen || at >= bLen || a[at] !== b[at]) {
        return false
      }
      k += 1
    }
    i += n + 1
  }
}

/** Copies `name`, a name `dnsReadName` wrote, into `into`. */
const dnsCopyName = (name: u8[], into: u8[]): void => {
  let i: i32 = 0
  const nameLen: i32 = toI32(name.length)
  const intoLen: i32 = toI32(into.length)
  while (true) {
    // The name is no longer than `DNS_MAX_NAME_BYTES` (255).
    if (i < 0 || i >= nameLen || i >= 255) {
      return
    }
    const n: i32 = toI32(name[i])
    let k: i32 = 0
    while (k <= n) {
      const at: i32 = i + k
      if (at >= nameLen || at >= intoLen) {
        return
      }
      into[at] = name[at]
      k += 1
    }
    if (n === 0) {
      return
    }
    i += n + 1
  }
}

/**
 * Keeps the RDATA at `msg[at]`, `size` bytes, as the next address of `reply`,
 * with `port` and `ttl`, and answers whether it was kept: an address past
 * `DNS_MAX_ANSWERS`, or one neither 4 nor 16 bytes, is not.
 */
const dnsKeepAddress = (msg: u8[], at: i32, size: i32, port: i32, ttl: i32, reply: DnsReply): boolean => {
  const count: i32 = reply.count
  // `DNS_MAX_ANSWERS` is 8.
  if (count < 0 || count >= 8 || (size !== 4 && size !== 16)) {
    return false
  }
  // The caller read the RDATA's length against the message.
  if (at < 0 || at > 65535 || size > toI32(msg.length) - at) {
    return false
  }
  const addresses: u8[] = reply.addresses
  const ttls: i32[] = reply.ttls
  if (toI32(addresses.length) < 144 || toI32(ttls.length) < 8) {
    return false
  }
  ttls[count] = ttl
  const base: i32 = count * DNS_ADDRESS_BYTES
  const lead: i32 = 16 - size
  let k: i32 = 0
  while (k < lead) {
    addresses[base + k] = toU8(0)
    k += 1
  }
  if (size === 4) {
    addresses[base + 10] = toU8(255)
    addresses[base + 11] = toU8(255)
  }
  k = 0
  while (k < size) {
    const from: i32 = at + k
    if (from >= toI32(msg.length)) {
      return false
    }
    const to: i32 = base + lead + k
    if (to < 0 || to >= toI32(addresses.length)) {
      return false
    }
    addresses[to] = msg[from]
    k += 1
  }
  // The port, big-endian, in the address's last two bytes.
  addresses[base + 16] = toU8((port >> 8) & 255)
  addresses[base + 17] = toU8(port & 255)
  reply.count = count + 1
  return true
}

/**
 * Reads `msg[0, len)` as the reply to `query[0, queryLen)`, a query
 * `dnsBuildQuery` wrote, into `reply`, with `port` written into every address.
 *
 * Answers `DNS_NOERROR`, `DNS_NXDOMAIN`, `DNS_SERVFAIL` or `DNS_REFUSED` for a
 * reply that answers the query, or a `DNS_ERR_*` code for one that is
 * malformed or answers another. The answer records are read only under
 * NOERROR and with TC clear; with TC set, `reply.truncated` says so,
 * `reply.count` is 0 whatever the counts claim, and the caller asks again
 * over TCP. The authority and additional sections are counted against the
 * bytes left and never read. `reply` is reset first and written in place, so
 * nothing is allocated; it holds this reply's answer until the next call.
 *
 * @param msg The datagram (or TCP message, without its length) that came back.
 * @param len How many bytes of `msg`, from offset 0, are the reply; a length
 *   outside `msg` panics.
 * @param query The query this reply should answer, as `dnsBuildQuery` wrote
 *   it: the reply's ID and question are compared with its bytes. A query under
 *   12 bytes, or with another ID, answers `DNS_ERR_ID`; once the reply passes
 *   the ID, QR, opcode and QDCOUNT checks, a query whose question cannot be
 *   read back panics.
 * @param queryLen The query's length, as `dnsBuildQuery` answered it; a length
 *   outside `query` panics.
 * @param port The port, 0 to 0xFFFF, written big-endian into the last two bytes
 *   of every kept address; any other value panics.
 * @param reply The caller's reused `DnsReply`, reset and filled in.
 * @returns The reply's RCODE when it answers the query (`DNS_NOERROR`,
 *   `DNS_NXDOMAIN`, `DNS_SERVFAIL` or `DNS_REFUSED`), with the addresses in
 *   `reply` only under `DNS_NOERROR` with `reply.truncated` clear; or a
 *   negative `DNS_ERR_*` code: `DNS_ERR_RCODE` for a reply to this query
 *   with any other RCODE (FORMERR, NOTIMP or one undefined), and the others
 *   for a reply that is malformed or answers another query.
 */
export const dnsParseReply = (
  msg: u8[],
  len: i32,
  query: u8[],
  queryLen: i32,
  port: i32,
  reply: DnsReply
): i32 => {
  dnsCheckLength(msg, len, "dnsParseReply")
  dnsCheckLength(query, queryLen, "dnsParseReply")
  if (port < 0 || port > 0xffff) {
    panic(`dnsParseReply: the port ${port} is not 16 bits`)
  }
  reply.count = 0
  reply.dropped = 0
  reply.rcode = 0
  reply.truncated = false
  // `len` lies in `msg` (checked above), so the second test is never taken: it
  // is the one the reads below index from.
  if (len < 12 || toI32(msg.length) < 12) {
    return DNS_ERR_HEADER
  }
  const flags: i32 = toI32(dnsBe16(msg[2], msg[3]))
  if ((flags & DNS_FLAG_QR) === 0) {
    return DNS_ERR_NOT_REPLY
  }
  if (((flags >> 11) & 15) !== 0) {
    return DNS_ERR_OPCODE
  }
  if (queryLen < 12 || toI32(query.length) < 12 || dnsBe16(msg[0], msg[1]) !== dnsBe16(query[0], query[1])) {
    return DNS_ERR_ID
  }
  if (dnsBe16(msg[4], msg[5]) !== toU16(1)) {
    return DNS_ERR_QUESTION
  }
  const asked: i32 = dnsReadName(query, queryLen, DNS_HEADER_BYTES, reply.asked)
  // `DNS_QUERY_MAX_BYTES` (271) holds any query dnsBuildQuery writes.
  if (asked < 0 || asked > queryLen - 4 || asked > toI32(query.length) - 4 || asked > 267) {
    panic("dnsParseReply: the query is not one dnsBuildQuery wrote")
  }
  const named: i32 = dnsReadName(msg, len, DNS_HEADER_BYTES, reply.chain)
  if (named < 0) {
    return named
  }
  // dnsReadName reads no name past 65535, the longest a message can be.
  if (named > len - 4 || named > toI32(msg.length) - 4 || named > 65535) {
    return DNS_ERR_SHORT
  }
  if (
    !dnsSameName(reply.chain, reply.asked) ||
    msg[named] !== query[asked] ||
    msg[named + 1] !== query[asked + 1] ||
    msg[named + 2] !== query[asked + 2] ||
    msg[named + 3] !== query[asked + 3]
  ) {
    return DNS_ERR_QUESTION
  }
  const qtype: i32 = toI32(dnsBe16(query[asked], query[asked + 1]))
  reply.truncated = (flags & DNS_FLAG_TC) !== 0
  const rcode: i32 = flags & 15
  reply.rcode = rcode
  if (rcode !== DNS_NOERROR && rcode !== DNS_SERVFAIL && rcode !== DNS_NXDOMAIN && rcode !== DNS_REFUSED) {
    return DNS_ERR_RCODE
  }
  // A truncated reply's counts describe the records the server could not fit,
  // so they are not held to the bytes that arrived.
  if (reply.truncated) {
    return rcode
  }
  let pos: i32 = named + 4
  const answers: i32 = toI32(dnsBe16(msg[6], msg[7]))
  const records: i32 = answers + toI32(dnsBe16(msg[8], msg[9])) + toI32(dnsBe16(msg[10], msg[11]))
  if (records > (len - pos) / DNS_MIN_RECORD_BYTES) {
    return DNS_ERR_COUNT
  }
  if (rcode !== DNS_NOERROR) {
    return rcode
  }
  let dropped: i32 = 0
  let i: i32 = 0
  while (i < answers) {
    const fixed: i32 = dnsReadName(msg, len, pos, reply.owner)
    if (fixed < 0) {
      return fixed
    }
    if (fixed > len - 10 || fixed > toI32(msg.length) - 10 || fixed > 65535) {
      return DNS_ERR_SHORT
    }
    const type: i32 = toI32(dnsBe16(msg[fixed], msg[fixed + 1]))
    const klass: i32 = toI32(dnsBe16(msg[fixed + 2], msg[fixed + 3]))
    const ttlBits: u32 =
      (toU32(msg[fixed + 4]) << 24) |
      (toU32(msg[fixed + 5]) << 16) |
      (toU32(msg[fixed + 6]) << 8) |
      toU32(msg[fixed + 7])
    const rawTtl: i32 = toI32(ttlBits)
    const size: i32 = toI32(dnsBe16(msg[fixed + 8], msg[fixed + 9]))
    const data: i32 = fixed + 10
    if (size > len - data) {
      return DNS_ERR_RDATA
    }
    if (klass === DNS_CLASS_IN) {
      if ((type === DNS_TYPE_A && size !== 4) || (type === DNS_TYPE_AAAA && size !== 16)) {
        return DNS_ERR_RDLENGTH
      }
      if (dnsSameName(reply.owner, reply.chain)) {
        if (type === DNS_TYPE_CNAME) {
          const target: i32 = dnsReadName(msg, data + size, data, reply.owner)
          if (target < 0) {
            return target
          }
          if (target !== data + size) {
            return DNS_ERR_RDATA
          }
          dnsCopyName(reply.owner, reply.chain)
        } else if (type === qtype && !dnsKeepAddress(msg, data, size, port, rawTtl < 0 ? 0 : rawTtl, reply)) {
          // One per record before this one at most, so under `answers`.
          if (dropped < answers) {
            dropped += 1
            reply.dropped = dropped
          }
        }
      }
    }
    pos = data + size
    i += 1
  }
  return DNS_NOERROR
}
