// QUIC packet headers (std/net/quic-packet.ts) under an instruction count:
// `n` rounds that each write a datagram of three coalesced packets (an
// Initial with a token, a Handshake and a 1-RTT short header) with
// quicPutLongHeader and quicPutShortHeader, parse each header back with
// quicParseHeaderInto, and decode the packet numbers and a run of varints.
// No payload is protected, so the count is the header code's and not the
// AEAD's. It reaches the cursor, varint and length reads whose panic sites
// the std/ ratchet counts, so a fix to one of them shows here as a count that
// holds or falls. It prints a sum over what it parsed.
import {
  QUIC_AEAD_TAG_SIZE,
  QUIC_PACKET_HANDSHAKE,
  QUIC_PACKET_INITIAL,
  QUIC_PACKET_OK,
  QuicHeader,
  quicPacketNumberDecode,
  quicPacketNumberLength,
  quicParseHeaderInto,
  quicPutLongHeader,
  quicPutShortHeader,
  quicVarintLength,
  quicVarintPush,
  quicVarintRead,
} from "nish/net/quic-packet"

/** `length` bytes counting up from `from`. */
const bytes = (length: i32, from: i32): u8[] => {
  const out: u8[] = []
  for (let i: i32 = 0; i < length; i++) {
    out.push(toU8((from + i) & 255))
  }
  return out
}

export const main = (): i32 => {
  const n: i32 = 50000 // bench:n
  const dcid: u8[] = bytes(8, 0x83)
  const scid: u8[] = bytes(8, 0x41)
  const token: u8[] = bytes(16, 0x10)
  const payload: i32 = 40
  const datagram: u8[] = new Array<u8>(1200)
  const header = new QuicHeader()
  const varints: u8[] = []
  const values: i64[] = [
    0, 37, 63, 64, 15293, 16383, 16384, 494878333, 1073741823, 1073741824, 4294967296, 1099511627776,
  ]
  for (let i: i32 = 0; i < values.length; i++) {
    quicVarintPush(varints, values[i])
  }
  const varintEnd: i32 = toI32(varints.length)
  let sum: i64 = 0
  let largest: i64 = 0xa82f30ea
  for (let round: i32 = 0; round < n; round++) {
    const pn: i64 = largest + toI64(round & 7) + 1
    const pnLength: i32 = quicPacketNumberLength(pn, largest)
    let at: i32 = quicPutLongHeader(
      datagram,
      0,
      QUIC_PACKET_INITIAL,
      dcid,
      8,
      scid,
      8,
      token,
      pn,
      pnLength,
      payload
    )
    at = at + payload + QUIC_AEAD_TAG_SIZE
    at = quicPutLongHeader(datagram, at, QUIC_PACKET_HANDSHAKE, dcid, 8, scid, 8, [], pn, pnLength, payload)
    at = at + payload + QUIC_AEAD_TAG_SIZE
    at = quicPutShortHeader(datagram, at, dcid, 8, (round & 1) === 1, false, pn, pnLength)
    if (at < 0) {
      console.log(`write failed on round ${round}`)
      return 1
    }
    const end: i32 = at + payload
    let start: i32 = 0
    while (start < end) {
      if (quicParseHeaderInto(header, datagram, start, end, 8) !== QUIC_PACKET_OK) {
        console.log(`parse failed at ${start} on round ${round}: ${header.error}`)
        return 1
      }
      sum += toI64(header.type) + toI64(header.dcidLength + header.scidLength + header.tokenLength)
      sum += toI64(header.pnOffset)
      const next: i32 = header.end > end || header.end <= start ? end : header.end
      start = next
    }
    let v: i32 = 0
    while (v < varintEnd) {
      sum += quicVarintRead(varints, v, varintEnd) & 0xffff
      v += quicVarintLength(varints, v)
    }
    sum += quicPacketNumberDecode(largest, pn & 0xffff, 2) - largest
    largest = pn
  }
  console.log(`${sum}`)
  return 0
}
