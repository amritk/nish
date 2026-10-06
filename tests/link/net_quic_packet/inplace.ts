// The in-place forms a connection reads and writes every packet with: the
// header read as windows (`quicParseHeaderInto`), headers written into a
// buffer (`quicPutLongHeader`, `quicPutShortHeader`, `quicVarintPut`), a
// packet sealed where it lies (`quicSealInPlace`) and opened storing only
// numbers into a reused `QuicPacket` (`quicUnprotectHeader`,
// `quicDecryptPayload`). Each gives RFC 9001 Appendix A's bytes, as the
// allocating forms do, and refuses what they refuse.
import { Suite } from "nish/testing";
import {
  QUIC_AEAD_AES_128_GCM,
  QUIC_AEAD_CHACHA20_POLY1305,
  QUIC_ERR_DECRYPT,
  QUIC_ERR_TRUNCATED,
  QUIC_PACKET_INITIAL,
  QUIC_PACKET_OK,
  QUIC_PACKET_SHORT,
  QuicHeader,
  QuicKeys,
  QuicPacket,
  quicDecryptPayload,
  quicLongHeaderSize,
  quicPacketGrow,
  quicParseHeaderInto,
  quicPutLongHeader,
  quicPutShortHeader,
  quicSealInPlace,
  quicUnprotectHeader,
  quicVarintPut,
} from "nish/net/quic-packet";
import { bytesOf, hexOf, joined } from "./bytes";
import { a2Frames, a5Packet, a5Secret, clientDcid, initialOf, keysOf } from "./checks";
import { a2Packet } from "./vectors";

/** The first `n` bytes of `buf`. */
const head = (buf: u8[], n: i32): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < n && k < toI32(buf.length); k++) {
    out.push(buf[k]);
  }
  return out;
};

/** Headers written in place, and varints. */
const headerChecks = (t: Suite): void => {
  const buf: u8[] = new Array<u8>(1200);
  const none: u8[] = [];
  const slot: u8[] = new Array<u8>(20);
  const dcid: u8[] = clientDcid();
  for (let k: i32 = 0; k < 8; k++) {
    slot[k] = dcid[k];
  }
  t.eqI32("quicLongHeaderSize sizes A.2's header", quicLongHeaderSize(QUIC_PACKET_INITIAL, 8, 0, 0, 2, 4, 1162), toI32(22));
  t.eqI32("and is 0 for a type that has none", quicLongHeaderSize(QUIC_PACKET_SHORT, 8, 0, 0, 2, 4, 1162), toI32(0));
  const end: i32 = quicPutLongHeader(buf, 0, QUIC_PACKET_INITIAL, slot, 8, none, 0, none, 2, 4, 1162);
  t.eqI32("quicPutLongHeader writes A.2's header from an ID in a 20-byte slot", end, toI32(22));
  t.eqStr("byte for byte", hexOf(head(buf, end)), "c300000001088394c8f03e5157080000449e00000002");
  t.eqI32("and refuses a buffer one byte short", quicPutLongHeader(buf, 1179, QUIC_PACKET_INITIAL, slot, 8, none, 0, none, 2, 4, 1162), toI32(-1));
  t.eqI32("or an ID length past its array", quicPutLongHeader(buf, 0, QUIC_PACKET_INITIAL, slot, 21, none, 0, none, 2, 4, 1162), toI32(-1));
  const shortEnd: i32 = quicPutShortHeader(buf, 0, none, 0, false, false, 654360564, 3);
  t.eqStr("quicPutShortHeader writes A.5's", hexOf(head(buf, shortEnd)), "4200bff4");
  t.eqI32("and refuses a packet-number length of 5", quicPutShortHeader(buf, 0, none, 0, false, false, 1, 5), toI32(-1));
  t.eqI32("quicVarintPut writes 37 in two bytes", quicVarintPut(buf, 0, 37, 2), toI32(2));
  t.eqStr("as 4025", hexOf(head(buf, 2)), "4025");
  t.eqI32("and refuses a size of 3", quicVarintPut(buf, 0, 37, 3), toI32(-1));
  t.eqI32("or a size too short for the value", quicVarintPut(buf, 0, 16384, 2), toI32(-1));
  t.eqI32("or a buffer without the room", quicVarintPut(buf, 1199, 16384, 4), toI32(-1));
  const grown: u8[] = [];
  quicPacketGrow(grown, 3);
  t.eqStr("quicPacketGrow appends zeros for a writer to fill", hexOf(grown), "000000");
};

/** A.2 and A.5 sealed and opened in place. */
const packetChecks = (t: Suite): void => {
  const keys: QuicKeys = keysOf(QUIC_AEAD_AES_128_GCM, initialOf(clientDcid()).client);
  const buf: u8[] = new Array<u8>(1200);
  const none: u8[] = [];
  const headerEnd: i32 = quicPutLongHeader(buf, 0, QUIC_PACKET_INITIAL, clientDcid(), 8, none, 0, none, 2, 4, 1162);
  const frames: u8[] = a2Frames();
  for (let k: i32 = 0; k < toI32(frames.length); k++) {
    buf[headerEnd + k] = frames[k];
  }
  t.eqI32("quicSealInPlace seals A.2 where it lies, ending at 1200", quicSealInPlace(keys, buf, 0, headerEnd, 1162, 2), toI32(1200));
  t.eqStr("byte for byte", hexOf(buf), a2Packet());
  const tight: u8[] = new Array<u8>(1199);
  t.eqI32("with no room for the tag it refuses", quicSealInPlace(keys, tight, 0, headerEnd, 1162, 2), toI32(-1));
  t.eqI32("and with a packet number the header does not carry", quicSealInPlace(keys, buf, 0, headerEnd, 1162, 3), toI32(-1));

  const datagram: u8[] = bytesOf(a2Packet());
  const header = new QuicHeader();
  t.eqI32("quicParseHeaderInto reads A.2", quicParseHeaderInto(header, datagram, 0, 1200, 8), QUIC_PACKET_OK);
  t.ok("as windows: the DCID at 6, 8 bytes, no SCID, no token", header.dcidStart === 6 && header.dcidLength === 8 && header.scidLength === 0 && header.tokenLength === 0);
  t.ok("and leaves the header's arrays alone", toI32(header.dcid.length) === 0);
  const packet = new QuicPacket();
  const clear: u8[] = quicUnprotectHeader(keys, datagram, header, -1, packet);
  t.ok("quicUnprotectHeader answers the header in the clear and packet number 2", hexOf(clear) === "c300000001088394c8f03e5157080000449e00000002" && packet.packetNumber === 2);
  t.ok("storing nothing but numbers into the packet", toI32(packet.header.length) === 0 && toI32(packet.payload.length) === 0);
  const plain: u8[] | null = quicDecryptPayload(keys, datagram, header, clear, packet);
  t.ok("quicDecryptPayload answers the frames", plain !== null && hexOf(plain) === hexOf(frames) && packet.error === QUIC_PACKET_OK);
  const forged: u8[] = joined(head(datagram, 1199), [toU8(toI32(datagram[1199]) ^ 1)]);
  const forgedClear: u8[] = quicUnprotectHeader(keys, forged, header, -1, packet);
  t.ok("a flipped tag byte does not open", quicDecryptPayload(keys, forged, header, forgedClear, packet) === null && packet.error === QUIC_ERR_DECRYPT);
  t.ok("and a packet in error is not opened again", quicDecryptPayload(keys, datagram, header, clear, packet) === null);
  const cut = new QuicHeader();
  t.eqI32("a limit inside the header is QUIC_ERR_TRUNCATED", quicParseHeaderInto(cut, datagram, 0, 4, 8), QUIC_ERR_TRUNCATED);
  t.ok("and unprotecting it answers nothing", toI32(quicUnprotectHeader(keys, datagram, cut, -1, packet).length) === 0 && packet.error === QUIC_ERR_TRUNCATED);

  // A.5 in a larger buffer, read up to the limit: a GRO receive's first datagram.
  const chacha: QuicKeys = keysOf(QUIC_AEAD_CHACHA20_POLY1305, a5Secret());
  const gro: u8[] = joined(a5Packet(), bytesOf("ffffffffff"));
  const short = new QuicHeader();
  t.eqI32("a short header read up to a limit", quicParseHeaderInto(short, gro, 0, 21, 0), QUIC_PACKET_OK);
  t.eqI32("ends at the limit, not the buffer", short.end, toI32(21));
  const shortClear: u8[] = quicUnprotectHeader(chacha, gro, short, 654360563, packet);
  const ping: u8[] | null = quicDecryptPayload(chacha, gro, short, shortClear, packet);
  t.ok("and A.5 opens from it: one PING", ping !== null && hexOf(ping) === "01");
};

/** Every in-place check. */
export const inPlaceChecks = (t: Suite): void => {
  headerChecks(t);
  packetChecks(t);
};
