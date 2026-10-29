// `nish/net/dns-message`: the query bytes, replies captured from a resolver,
// replies built to break each bound, and a seeded mutation pass. Every line
// names its case, and the run prints the same lines natively and under
// `--profile wasi`.
import {
  DNS_ADDRESS_BYTES,
  DNS_ERR_COUNT,
  DNS_ERR_EMPTY_LABEL,
  DNS_ERR_HEADER,
  DNS_ERR_HOPS,
  DNS_ERR_ID,
  DNS_ERR_LABEL_LONG,
  DNS_ERR_LABEL_TYPE,
  DNS_ERR_NAME_BYTE,
  DNS_ERR_NAME_LONG,
  DNS_ERR_NOT_REPLY,
  DNS_ERR_OPCODE,
  DNS_ERR_POINTER,
  DNS_ERR_QTYPE,
  DNS_ERR_QUESTION,
  DNS_ERR_RCODE,
  DNS_ERR_RDATA,
  DNS_ERR_RDLENGTH,
  DNS_ERR_SHORT,
  DNS_ERR_SPACE,
  DNS_MAX_ANSWERS,
  DNS_NOERROR,
  DNS_NXDOMAIN,
  DNS_QUERY_MAX_BYTES,
  DNS_REFUSED,
  DNS_SERVFAIL,
  DNS_TYPE_A,
  DNS_TYPE_AAAA,
  DnsReply,
  dnsBuildQuery,
  dnsParseReply,
} from "nish/net/dns-message"
import { Suite } from "nish/testing"

const HEX: string = "0123456789abcdef"

/** The bytes a lowercase hex string spells. */
const fromHex = (hex: string): u8[] => {
  const n: i32 = toI32(hex.length) / 2
  const out: u8[] = new Array<u8>(n)
  let i: i32 = 0
  while (i < n) {
    out[i] = toU8(toI32(HEX.indexOf(hex.substring(2 * i, 2 * i + 1))) * 16 + toI32(HEX.indexOf(hex.substring(2 * i + 1, 2 * i + 2))))
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

/** `bytes` followed by the bytes `hex` spells, as a new array. */
const append = (bytes: u8[], hex: string): u8[] => {
  const tail: u8[] = fromHex(hex)
  const out: u8[] = new Array<u8>(toI32(bytes.length) + toI32(tail.length))
  let i: i32 = 0
  while (i < toI32(bytes.length)) {
    out[i] = bytes[i]
    i += 1
  }
  let k: i32 = 0
  while (k < toI32(tail.length)) {
    out[i + k] = tail[k]
    k += 1
  }
  return out
}

/** The first `n` bytes of `bytes`, as a new array. */
const prefix = (bytes: u8[], n: i32): u8[] => {
  const out: u8[] = new Array<u8>(n)
  let i: i32 = 0
  while (i < n) {
    out[i] = bytes[i]
    i += 1
  }
  return out
}

/** A copy of `bytes` with `bytes[at]` set to `value`. */
const patched = (bytes: u8[], at: i32, value: i32): u8[] => {
  const out: u8[] = prefix(bytes, toI32(bytes.length))
  out[at] = toU8(value)
  return out
}

/** The query `dnsBuildQuery` writes for `name` and `qtype` under ID 0x1234, trimmed to its length. */
const query = (name: string, qtype: i32): u8[] => {
  const out: u8[] = new Array<u8>(DNS_QUERY_MAX_BYTES)
  const n: i32 = dnsBuildQuery(out, 0x1234, name, qtype)
  return n < 0 ? new Array<u8>(0) : prefix(out, n)
}

/** `dnsParseReply` of all of `msg` against all of `q`, on port 443. */
const parse = (msg: u8[], q: u8[], reply: DnsReply): i32 =>
  dnsParseReply(msg, toI32(msg.length), q, toI32(q.length), 443, reply)

/** Address `i` of `reply` as hex. */
const address = (reply: DnsReply, i: i32): string => toHex(reply.addresses, i * DNS_ADDRESS_BYTES, DNS_ADDRESS_BYTES)

/** A 64-byte label: one byte past the longest. */
const LABEL_64: string = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
const LABEL_63: string = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

// Replies captured from 8.8.8.8 on 2026-10-29 for queries written exactly as
// `query` writes them (ID 0x1234, RD, no EDNS). The resolver's path filtered
// AAAA and TXT answers, so the AAAA and TC replies below are built instead, on
// the layout of the A reply.

/** `example.com A`: two A records, each owner a pointer to the question (`c00c`). */
const CAPTURED_EXAMPLE_A: string =
  "123481800001000200000000076578616d706c6503636f6d0000010001c00c000100010000012c00046814179ac00c000100010000012c0004ac4293f3"
/** `www.microsoft.com A`: two CNAMEs, the second target compressed against the first, then one A record. */
const CAPTURED_MICROSOFT_A: string =
  "12348180000100030000000003777777096d6963726f736f667403636f6d0000010001c00c000500010000098d002303777777096d6963726f736f667407636f6d2d632d3307656467656b6579036e657400c02f000500010000003000190665313336373804647363620a616b616d616965646765c04dc05e0001000100000014000417362a27"
/** `nxdomain.invalid A`: RCODE 3 and no records. */
const CAPTURED_NXDOMAIN: string = "123481830001000000000000086e78646f6d61696e07696e76616c69640000010001"
/** `outlook.com A`: nine A records, one past `DNS_MAX_ANSWERS`. */
const CAPTURED_OUTLOOK_A: string =
  "123481800001000900000000076f75746c6f6f6b03636f6d0000010001c00c0001000100000114000434605b22c00c000100010000011400043460ac62c00c000100010000011400043460dee2c00c000100010000011400043460df02c00c0001000100000114000434606f52c00c000100010000011400043460d632c00c000100010000011400043460e482c00c000100010000011400043460e5f2c00c000100010000011400043460dec2"

/** The header and question of a reply to `example.com A` with `count` answers to follow, built. */
const exampleHead = (count: string): string => "12348180000100" + count + "00000000076578616d706c6503636f6d0000010001"

/** A reply whose second owner is a pointer to the last of `pointers` pointers in `run`, the first record's RDATA at 41. */
const hopsReply = (run: string, pointers: i32): u8[] => {
  const size: i32 = toI32(run.length) / 2
  return fromHex(
    exampleHead("02") +
      "c00c006300010000012c" +
      toHex([toU8(size >> 8), toU8(size & 255)], 0, 2) +
      run +
      "c0" +
      toHex([toU8(44 + (pointers - 1) * 2)], 0, 1) +
      "006300010000012c0000"
  )
}

/** A tiny deterministic generator: a 31-bit LCG, the same on every target. */
class Lcg {
  state: i64 = 0
  constructor(seed: i64) {
    this.state = seed
  }
  next(bound: i32): i32 {
    this.state = (this.state * toI64(1103515245) + toI64(12345)) & toI64(0x7fffffff)
    return toI32((this.state >> toI64(8)) % toI64(bound))
  }
}

export const main = (): number => {
  const t = new Suite("dns-message")
  const reply: DnsReply = new DnsReply()

  // --- dnsBuildQuery -----------------------------------------------------------
  const qa: u8[] = query("example.com", DNS_TYPE_A)
  t.eqStr("query: example.com A", toHex(qa, 0, toI32(qa.length)), "123401000001000000000000076578616d706c6503636f6d0000010001")
  const qaaaa: u8[] = query("example.com", DNS_TYPE_AAAA)
  t.eqStr("query: example.com AAAA", toHex(qaaaa, 0, toI32(qaaaa.length)), "123401000001000000000000076578616d706c6503636f6d00001c0001")
  const qdot: u8[] = query("example.com.", DNS_TYPE_A)
  t.eqStr("query: a trailing dot names the same root", toHex(qdot, 0, toI32(qdot.length)), toHex(qa, 0, toI32(qa.length)))
  const out: u8[] = new Array<u8>(DNS_QUERY_MAX_BYTES)
  t.eqI32("query: an empty name", dnsBuildQuery(out, 1, "", DNS_TYPE_A), DNS_ERR_EMPTY_LABEL)
  t.eqI32("query: the root alone", dnsBuildQuery(out, 1, ".", DNS_TYPE_A), DNS_ERR_EMPTY_LABEL)
  t.eqI32("query: an empty label in the middle", dnsBuildQuery(out, 1, "a..b", DNS_TYPE_A), DNS_ERR_EMPTY_LABEL)
  t.eqI32("query: a leading dot", dnsBuildQuery(out, 1, ".a", DNS_TYPE_A), DNS_ERR_EMPTY_LABEL)
  t.eqI32("query: two trailing dots", dnsBuildQuery(out, 1, "a..", DNS_TYPE_A), DNS_ERR_EMPTY_LABEL)
  t.eqI32("query: a 63-byte label fits", dnsBuildQuery(out, 1, LABEL_63 + ".com", DNS_TYPE_A), 12 + 69 + 4)
  t.eqI32("query: a 64-byte label", dnsBuildQuery(out, 1, LABEL_64 + ".com", DNS_TYPE_A), DNS_ERR_LABEL_LONG)
  // Three labels of 63 and one of 61: 253 bytes of text, 255 in wire form.
  const name253: string = LABEL_63 + "." + LABEL_63 + "." + LABEL_63 + "." + LABEL_63.substring(0, 61)
  t.eqI32("query: a 253-byte name fills 255 bytes of wire form", dnsBuildQuery(out, 1, name253, DNS_TYPE_A), DNS_QUERY_MAX_BYTES)
  t.eqI32("query: a 254-byte name", dnsBuildQuery(out, 1, name253 + "a", DNS_TYPE_A), DNS_ERR_NAME_LONG)
  t.eqI32("query: a 254-byte name with a trailing dot is still 253", dnsBuildQuery(out, 1, name253 + ".", DNS_TYPE_A), DNS_QUERY_MAX_BYTES)
  t.eqI32("query: a space", dnsBuildQuery(out, 1, "exa mple.com", DNS_TYPE_A), DNS_ERR_NAME_BYTE)
  t.eqI32("query: a control byte", dnsBuildQuery(out, 1, "exa\tmple.com", DNS_TYPE_A), DNS_ERR_NAME_BYTE)
  t.eqI32("query: a byte above 0x7e", dnsBuildQuery(out, 1, "café.com", DNS_TYPE_A), DNS_ERR_NAME_BYTE)
  t.eqI32("query: a CNAME question is not asked", dnsBuildQuery(out, 1, "example.com", 5), DNS_ERR_QTYPE)
  t.eqI32("query: one byte short of room", dnsBuildQuery(new Array<u8>(28), 1, "example.com", DNS_TYPE_A), DNS_ERR_SPACE)
  t.eqI32("query: exactly room", dnsBuildQuery(new Array<u8>(29), 1, "example.com", DNS_TYPE_A), 29)

  // --- captured replies --------------------------------------------------------
  const example: u8[] = fromHex(CAPTURED_EXAMPLE_A)
  t.eqI32("captured example.com A: NOERROR", parse(example, qa, reply), DNS_NOERROR)
  t.eqI32("captured example.com A: two addresses", reply.count, 2)
  t.eqStr("captured example.com A: 104.20.23.154 on 443", address(reply, 0), "00000000000000000000ffff6814179a01bb")
  t.eqStr("captured example.com A: 172.66.147.243 on 443", address(reply, 1), "00000000000000000000ffffac4293f301bb")
  t.eqI32("captured example.com A: TTL 300", reply.ttls[0], 300)
  t.eqBool("captured example.com A: not truncated", reply.truncated, false)
  t.eqI32("captured example.com A against an AAAA query: the question differs", parse(example, qaaaa, reply), DNS_ERR_QUESTION)

  const microsoft: u8[] = fromHex(CAPTURED_MICROSOFT_A)
  t.eqI32("captured www.microsoft.com A: the CNAME chain is followed", parse(microsoft, query("WWW.Microsoft.COM", DNS_TYPE_A), reply), DNS_NOERROR)
  t.eqI32("captured www.microsoft.com A: one address, at the chain's end", reply.count, 1)
  t.eqStr("captured www.microsoft.com A: 23.54.42.39", address(reply, 0), "00000000000000000000ffff17362a2701bb")
  t.eqI32("captured www.microsoft.com A: the A record's TTL", reply.ttls[0], 20)

  t.eqI32("captured nxdomain.invalid A: NXDOMAIN", parse(fromHex(CAPTURED_NXDOMAIN), query("nxdomain.invalid", DNS_TYPE_A), reply), DNS_NXDOMAIN)
  t.eqI32("captured nxdomain.invalid A: no address", reply.count, 0)
  t.eqI32("captured nxdomain.invalid A: rcode 3", reply.rcode, 3)

  const outlook: u8[] = fromHex(CAPTURED_OUTLOOK_A)
  t.eqI32("captured outlook.com A: NOERROR", parse(outlook, query("outlook.com", DNS_TYPE_A), reply), DNS_NOERROR)
  t.eqI32("captured outlook.com A: DNS_MAX_ANSWERS kept", reply.count, DNS_MAX_ANSWERS)
  t.eqI32("captured outlook.com A: the ninth dropped and counted", reply.dropped, 1)
  t.eqStr("captured outlook.com A: the eighth kept is the eighth sent", address(reply, 7), "00000000000000000000ffff3460e5f201bb")

  // The question's name in another case is the same name (RFC 4343).
  t.eqI32("captured example.com A, question as EXAMPLE: the same name", parse(patched(patched(example, 13, 69), 14, 88), qa, reply), DNS_NOERROR)

  // --- built replies -----------------------------------------------------------
  // `example.com AAAA` with one AAAA record for 2606:2800:21f:cb07:6820:80da:af6b:8b2c.
  const aaaa: u8[] = fromHex(
    "123481800001000100000000076578616d706c6503636f6d00001c0001c00c001c00010000012c001026062800021fcb07682080daaf6b8b2c"
  )
  t.eqI32("built example.com AAAA: NOERROR", parse(aaaa, qaaaa, reply), DNS_NOERROR)
  t.eqStr("built example.com AAAA: the sixteen bytes and port", address(reply, 0), "26062800021fcb07682080daaf6b8b2c01bb")

  // TC set and one answer present: nothing is read from a cut reply.
  t.eqI32("built TC reply: the rcode stands", parse(patched(example, 2, 0x83), qa, reply), DNS_NOERROR)
  t.eqBool("built TC reply: truncated", reply.truncated, true)
  t.eqI32("built TC reply: no record read", reply.count, 0)
  // TC set with an answer count no bytes back: the counts are not checked.
  t.eqI32("built TC reply, 255 answers claimed: the rcode stands", parse(patched(patched(example, 2, 0x83), 7, 0xff), qa, reply), DNS_NOERROR)
  t.eqBool("built TC reply, 255 answers claimed: truncated", reply.truncated, true)
  t.eqI32("built TC reply, 255 answers claimed: no record read", reply.count, 0)

  t.eqI32("built SERVFAIL", parse(patched(example, 3, 0x82), qa, reply), DNS_SERVFAIL)
  t.eqI32("built REFUSED", parse(patched(example, 3, 0x85), qa, reply), DNS_REFUSED)
  t.eqI32("built FORMERR", parse(patched(example, 3, 0x81), qa, reply), DNS_ERR_RCODE)
  t.eqI32("built NOTIMP", parse(patched(example, 3, 0x84), qa, reply), DNS_ERR_RCODE)

  // Records the question did not ask for are read past, not kept.
  const other: u8[] = fromHex(
    exampleHead("04") +
      // AAAA in an A reply
      "c00c001c00010000012c001026062800021fcb07682080daaf6b8b2c" +
      // A in class CH (3), five bytes long: another class is not checked
      "c00c000100030000012c00050102030405" +
      // A for another owner, `x.example.com`
      "0178c00c000100010000012c000401020304" +
      // the one that answers, its TTL's high bit set (RFC 2181 §8: read as 0)
      "c00c0001000180000000000401020305"
  )
  t.eqI32("built mixed records: NOERROR", parse(other, qa, reply), DNS_NOERROR)
  t.eqI32("built mixed records: only the asked type, class and owner kept", reply.count, 1)
  t.eqStr("built mixed records: 1.2.3.5", address(reply, 0), "00000000000000000000ffff0102030501bb")
  t.eqI32("built mixed records: a TTL above 2^31 - 1 reads as 0", reply.ttls[0], 0)

  // A CNAME for a name off the chain moves nothing; the A for its target is not kept.
  const offChain: u8[] = fromHex(
    exampleHead("02") + "0178c00c000500010000012c00040179c00c" + "c02b000100010000012c000401020304"
  )
  t.eqI32("built CNAME off the chain: NOERROR", parse(offChain, qa, reply), DNS_NOERROR)
  t.eqI32("built CNAME off the chain: no address", reply.count, 0)

  // --- malformed replies -------------------------------------------------------
  t.eqI32("malformed: an 11-byte header", parse(prefix(example, 11), qa, reply), DNS_ERR_HEADER)
  t.eqI32("malformed: an empty datagram", parse(new Array<u8>(0), qa, reply), DNS_ERR_HEADER)
  t.eqI32("malformed: QR clear", parse(patched(example, 2, 0x01), qa, reply), DNS_ERR_NOT_REPLY)
  t.eqI32("malformed: opcode 2 (STATUS)", parse(patched(example, 2, 0x91), qa, reply), DNS_ERR_OPCODE)
  t.eqI32("malformed: another ID", parse(patched(example, 1, 0x35), qa, reply), DNS_ERR_ID)
  t.eqI32("malformed: no question", parse(patched(example, 5, 0), qa, reply), DNS_ERR_QUESTION)
  t.eqI32("malformed: two questions", parse(patched(example, 5, 2), qa, reply), DNS_ERR_QUESTION)
  t.eqI32("malformed: another question name", parse(example, query("example.org", DNS_TYPE_A), reply), DNS_ERR_QUESTION)
  t.eqI32("malformed: another question class", parse(patched(example, 28, 3), qa, reply), DNS_ERR_QUESTION)
  t.eqI32("malformed: the question cut short", parse(prefix(example, 20), qa, reply), DNS_ERR_SHORT)
  t.eqI32("malformed: the question's type cut short", parse(prefix(example, 27), qa, reply), DNS_ERR_SHORT)
  t.eqI32("malformed: 65,535 answers in 61 bytes", parse(patched(patched(example, 6, 255), 7, 255), qa, reply), DNS_ERR_COUNT)
  t.eqI32("malformed: an additional count past the end", parse(patched(example, 11, 1), qa, reply), DNS_ERR_COUNT)
  t.eqI32("malformed: a forward pointer", parse(patched(example, 30, 0xff), qa, reply), DNS_ERR_POINTER)
  t.eqI32("malformed: a pointer into the header", parse(patched(example, 30, 5), qa, reply), DNS_ERR_POINTER)
  // The first answer's owner, at offset 29, points at itself.
  t.eqI32("malformed: a self-pointer", parse(patched(example, 30, 29), qa, reply), DNS_ERR_POINTER)
  // The first owner, at 29, is the label `x` and then a pointer back to 29.
  t.eqI32(
    "malformed: a label then a pointer back to its start",
    parse(fromHex(exampleHead("01") + "0178c01d000100010000012c000401020304"), qa, reply),
    DNS_ERR_POINTER
  )
  // Two pointers that point at each other, 29 -> 31 -> 29: the forward one is refused.
  t.eqI32(
    "malformed: a two-pointer loop",
    parse(fromHex(exampleHead("01") + "c01fc01d" + "00010000012c0004" + "01020304"), qa, reply),
    DNS_ERR_POINTER
  )
  t.eqI32("malformed: a label length byte 0x40", parse(patched(example, 29, 0x40), qa, reply), DNS_ERR_LABEL_TYPE)
  t.eqI32("malformed: a label length byte 0x80", parse(patched(example, 29, 0x80), qa, reply), DNS_ERR_LABEL_TYPE)
  t.eqI32("malformed: a label of 63 running past the end", parse(patched(example, 29, 63), qa, reply), DNS_ERR_SHORT)
  t.eqI32("malformed: an A record with RDLENGTH 5", parse(patched(example, 40, 5), qa, reply), DNS_ERR_RDLENGTH)
  t.eqI32("malformed: an A record with RDLENGTH 3", parse(patched(example, 40, 3), qa, reply), DNS_ERR_RDLENGTH)
  t.eqI32("malformed: an AAAA record with RDLENGTH 4", parse(patched(aaaa, 40, 4), qaaaa, reply), DNS_ERR_RDLENGTH)
  t.eqI32("malformed: the last RDATA one byte past the end", parse(prefix(example, 60), qa, reply), DNS_ERR_RDATA)
  t.eqI32("malformed: RDLENGTH 65,535", parse(patched(patched(example, 39, 255), 40, 255), qa, reply), DNS_ERR_RDATA)
  t.eqI32(
    "malformed: a record's fixed fields cut short",
    parse(fromHex(exampleHead("01") + "0178016100" + "000100010000"), qa, reply),
    DNS_ERR_SHORT
  )
  t.eqI32(
    "malformed: a CNAME whose target does not fill its RDATA",
    parse(fromHex(exampleHead("01") + "c00c000500010000012c0004017800" + "00"), qa, reply),
    DNS_ERR_RDATA
  )
  t.eqI32(
    "malformed: a CNAME whose target runs past its RDATA",
    parse(fromHex(exampleHead("01") + "c00c000500010000012c0002017800"), qa, reply),
    DNS_ERR_SHORT
  )
  t.eqI32(
    "malformed: a CNAME whose target points forwards",
    parse(fromHex(exampleHead("01") + "c00c000500010000012c0002c0ff"), qa, reply),
    DNS_ERR_POINTER
  )

  // Names past 255 bytes: labels of 63, 63, 63 and 61 make 255 with the root
  // byte; one more byte in the last label makes 256. Each is the owner of a
  // record of type 99, read past.
  let labels: string = ""
  let l: i32 = 0
  while (l < 3) {
    labels = labels + "3f"
    let k: i32 = 0
    while (k < 63) {
      labels = labels + "61"
      k += 1
    }
    l += 1
  }
  let last61: string = "3d"
  let last62: string = "3e"
  let k2: i32 = 0
  while (k2 < 62) {
    if (k2 < 61) {
      last61 = last61 + "61"
    }
    last62 = last62 + "61"
    k2 += 1
  }
  t.eqI32(
    "built: an owner of exactly 255 bytes",
    parse(fromHex(exampleHead("01") + labels + last61 + "00" + "006300010000012c0000"), qa, reply),
    DNS_NOERROR
  )
  t.eqI32(
    "malformed: an owner of 256 bytes",
    parse(fromHex(exampleHead("01") + labels + last62 + "00" + "006300010000012c0000"), qa, reply),
    DNS_ERR_NAME_LONG
  )
  // A name made long by compression: 3 x 64 bytes at 29, then a record whose
  // owner is a 63-byte label and a pointer to them, 256 bytes in all.
  t.eqI32(
    "malformed: a name past 255 bytes by a pointer",
    parse(
      fromHex(exampleHead("02") + labels + "00" + "006300010000012c0000" + last62 + "c01d" + "006300010000012c0000"),
      qa,
      reply
    ),
    DNS_ERR_NAME_LONG
  )

  // Pointer hops. A record of type 99 at 29 holds, in its RDATA from 41, the
  // name `x` (3 bytes) and then a run of pointers, each to the one before;
  // the second record's owner points at the last of the run. `hops` pointers
  // in the run make `hops + 1` hops from that owner.
  let run16: string = "017800"
  let run15: string = ""
  let p: i32 = 0
  while (p < 16) {
    const target: i32 = p === 0 ? 41 : 44 + (p - 1) * 2
    const ptr: string = "c0" + toHex([toU8(target)], 0, 1)
    run16 = run16 + ptr
    if (p === 14) {
      run15 = run16
    }
    p += 1
  }
  t.eqI32("built: a name of 16 hops", parse(hopsReply(run15, 15), qa, reply), DNS_NOERROR)
  t.eqI32("malformed: a name of 17 hops", parse(hopsReply(run16, 16), qa, reply), DNS_ERR_HOPS)

  // --- mutation pass -----------------------------------------------------------
  // Each round copies one captured reply, sets one to four bytes at random
  // offsets to random values, sometimes cuts it short, and parses it. What is
  // pinned is the tally: no round panics, and every answer is a reply status
  // or one of the codes dnsParseReply documents (DNS_ERR_NAME_LONG, or
  // DNS_ERR_HEADER through DNS_ERR_RCODE).
  const seeds: u8[][] = [example, microsoft, outlook, aaaa, other]
  const queries: u8[][] = [qa, query("www.microsoft.com", DNS_TYPE_A), query("outlook.com", DNS_TYPE_A), qaaaa, qa]
  const rng: Lcg = new Lcg(toI64(20261029))
  const tally: i32[] = new Array<i32>(32)
  let answered: i32 = 0
  let round: i32 = 0
  while (round < 4000) {
    const pick: i32 = rng.next(5)
    const base: u8[] = seeds[pick]
    let len: i32 = toI32(base.length)
    const msg: u8[] = prefix(base, len)
    const edits: i32 = 1 + rng.next(4)
    let e: i32 = 0
    while (e < edits) {
      msg[rng.next(len)] = toU8(rng.next(256))
      e += 1
    }
    if (rng.next(4) === 0) {
      len = rng.next(len + 1)
    }
    const status: i32 = dnsParseReply(msg, len, queries[pick], toI32(queries[pick].length), 53, reply)
    const slot: i32 = status < 0 ? 12 - status : status
    tally[slot] = tally[slot] + 1
    if (
      status === DNS_NOERROR ||
      status === DNS_SERVFAIL ||
      status === DNS_NXDOMAIN ||
      status === DNS_REFUSED ||
      status === DNS_ERR_NAME_LONG ||
      (status <= DNS_ERR_HEADER && status >= DNS_ERR_RCODE)
    ) {
      answered += 1
    }
    round += 1
  }
  let line: string = "mutation tally:"
  let s: i32 = 0
  while (s < 32) {
    if (tally[s] > 0) {
      line = line + " " + `${s < 12 ? s : 12 - s}` + "=" + `${tally[s]}`
    }
    s += 1
  }
  console.log(line)
  t.eqI32("mutation: every round answers a status or a documented code", answered, 4000)
  return t.done()
}
