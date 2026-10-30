// The QUIC header parser and packet-number decoder (`nish/net/quic-packet`)
// over a peer's bytes, as a libFuzzer target: `fuzzOne` takes one input and
// keeps nothing past it, and a refusal is an error code in the header, so a
// panic here is a finding (docs/security/quic.md).
//
// The input is a 14-byte prefix and then a datagram:
//
// - byte 0: the length of the connection IDs this endpoint hands out, which
//   is how a short header's DCID is delimited, as `byte % 21` (0 to 20).
// - byte 1: the packet number length, `byte % 4 + 1`; bit 2 set takes one
//   off the largest packet number, so that -1 (none processed) is reached.
// - bytes 2 to 9: the largest packet number processed, big-endian with the
//   top two bits dropped, so it is below 2^62.
// - bytes 10 to 13: the truncated packet number, big-endian, reduced to fit
//   in the packet number length.
// - the rest: one datagram, walked as a receiver walks coalesced packets,
//   from header to header by each one's `end`, until a refusal or the end.
//
// The datagram is left in place behind the prefix rather than copied out, so
// the parser also reads at a non-zero `at`, as it does inside a GRO buffer.
// Each packet's own packet number bytes are decoded too, still masked by
// header protection, which is fine: every value of them is one a peer can
// send. A decoded packet number that is not the one RFC 9000 §A.3 names, or a
// header window outside the datagram, panics, so the contract is checked
// rather than only the absence of a bounds failure.
import {
  QUIC_MAX_VARINT,
  QUIC_PACKET_OK,
  QuicHeader,
  quicPacketNumberDecode,
  quicParseHeader,
  quicParseHeaderInto,
} from "nish/net/quic-packet"

/** How many bytes come before the datagram. */
const PREFIX: i32 = 14

/** `bytes[at .. at + count)` as a big-endian number; the caller keeps `count` at 8 or under. */
const bigEndian = (bytes: u8[], at: i32, count: i32): i64 => {
  let value: i64 = 0
  for (let k: i32 = at; k < at + count; k += 1) {
    if (k >= 0 && k < toI32(bytes.length)) {
      value = (value << 8) | toI64(bytes[k])
    }
  }
  return value
}

/** How far `a` is from `b`; both stay within a window of 2^62, so the difference cannot overflow. */
const distance = (a: i64, b: i64): i64 => (a > b ? a - b : b - a)

/**
 * Decodes `truncatedPn` and panics unless the answer is the packet number
 * §17.1 means: below 2^62, ending in `truncatedPn`, and with no other such
 * packet number nearer to `largestPn + 1`. Every argument is inside the
 * documented domain, so -1 is a wrong answer too.
 */
const checkDecode = (largestPn: i64, truncatedPn: i64, pnLength: i32): void => {
  const decoded: i64 = quicPacketNumberDecode(largestPn, truncatedPn, pnLength)
  const window: i64 = toI64(1) << (toI64(pnLength) * 8)
  if (decoded < 0 || decoded > QUIC_MAX_VARINT) {
    panic("quicPacketNumberDecode: the answer is not a packet number")
  }
  if (decoded % window !== truncatedPn) {
    panic("quicPacketNumberDecode: the answer does not end in the truncated packet number")
  }
  const expected: i64 = largestPn + 1
  const gap: i64 = distance(decoded, expected)
  const up: i64 = decoded + window
  const down: i64 = decoded - window
  if (up <= QUIC_MAX_VARINT && distance(up, expected) < gap) {
    panic("quicPacketNumberDecode: one window up is nearer")
  }
  if (down >= 0 && distance(down, expected) < gap) {
    panic("quicPacketNumberDecode: one window down is nearer")
  }
}

/** Panics unless the window `[start, start + length)` lies inside `[from, end)`. */
const checkWindow = (start: i32, length: i32, from: i32, end: i32, what: string): void => {
  if (length < 0 || (length > 0 && (start < from || start + length > end))) {
    panic(what)
  }
}

/**
 * Checks the windows of a header that parsed: each lies inside the datagram
 * and the packet ends after it starts, where the next can start. A Retry's
 * `pnOffset` is where its tag starts, which is still inside the packet.
 */
const checkHeader = (header: QuicHeader, data: u8[], from: i32, end: i32): void => {
  checkWindow(header.dcidStart, header.dcidLength, from, end, "the DCID window is outside the datagram")
  checkWindow(header.scidStart, header.scidLength, from, end, "the SCID window is outside the datagram")
  checkWindow(header.tokenStart, header.tokenLength, from, end, "the token window is outside the datagram")
  if (header.pnOffset < from || header.pnOffset > header.end || header.end > end || header.end <= header.start) {
    panic("the packet's offsets are out of order")
  }
}

export const fuzzOne = (data: u8[]): void => {
  const n: i32 = toI32(data.length)
  if (n < PREFIX) {
    return
  }
  const shortDcidLength: i32 = toI32(data[0]) % 21
  const pnLength: i32 = (toI32(data[1]) % 4) + 1
  const lower: boolean = toI32(data[1]) % 8 >= 4
  // The top byte's high two bits are dropped first, so the shift stays below 2^62.
  const high: i64 = toI64(toI32(data[2]) % 64) << 56
  const largestPn: i64 = (high | bigEndian(data, 3, 7)) - (lower ? toI64(1) : toI64(0))
  const window: i64 = toI64(1) << (toI64(pnLength) * 8)
  checkDecode(largestPn, bigEndian(data, 10, 4) % window, pnLength)

  const header: QuicHeader = new QuicHeader()
  let at: i32 = PREFIX
  while (at < n) {
    if (quicParseHeaderInto(header, data, at, n, shortDcidLength) !== QUIC_PACKET_OK) {
      break
    }
    checkHeader(header, data, PREFIX, n)
    // The first byte's low two bits are the packet number length once
    // unprotected; masked, they are still some length a peer could send.
    const ownLength: i32 = at >= 0 && at < toI32(data.length) ? (toI32(data[at]) % 4) + 1 : 1
    if (header.pnOffset + ownLength <= header.end) {
      checkDecode(largestPn, bigEndian(data, header.pnOffset, ownLength), ownLength)
    }
    if (header.end <= at) {
      break
    }
    at = header.end
  }

  // The copying form, over the datagram on its own, as a caller that holds
  // one datagram per array reads it.
  const datagram: u8[] = []
  for (let k: i32 = PREFIX; k < n; k += 1) {
    if (k >= 0 && k < toI32(data.length)) {
      datagram.push(data[k])
    }
  }
  const copied: QuicHeader = quicParseHeader(datagram, 0, shortDcidLength)
  if (copied.error === QUIC_PACKET_OK && toI32(copied.dcid.length) !== copied.dcidLength) {
    panic("quicParseHeader: the DCID copy is not its window's length")
  }
}
