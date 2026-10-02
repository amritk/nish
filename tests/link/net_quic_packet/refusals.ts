// Every refusal in `nish/net/quic-packet`, each reached by an input built to
// reach it alone: the parse errors a peer's datagram can provoke, the open
// errors a damaged or mis-keyed packet provokes, and the `null`s and `false`s
// the builders answer for arguments out of range. The module's header lists
// what each `QUIC_ERR_*` means; this file is where each one is shown to
// happen.
import { Suite } from "nish/testing";
import { aesKey } from "nish/crypto/aes";
import {
  QUIC_AEAD_AES_128_GCM,
  QUIC_AEAD_AES_256_GCM,
  QUIC_AEAD_CHACHA20_POLY1305,
  QUIC_ERR_CID_LENGTH,
  QUIC_ERR_DECRYPT,
  QUIC_ERR_FIXED_BIT,
  QUIC_ERR_LENGTH,
  QUIC_ERR_NOT_PROTECTED,
  QUIC_ERR_RESERVED_BITS,
  QUIC_ERR_SAMPLE,
  QUIC_ERR_TRUNCATED,
  QUIC_ERR_VERSION,
  QUIC_MAX_VARINT,
  QUIC_PACKET_HANDSHAKE,
  QUIC_PACKET_INITIAL,
  QUIC_PACKET_OK,
  QUIC_PACKET_RETRY,
  QUIC_PACKET_SHORT,
  QuicHeader,
  QuicKeys,
  QuicPacket,
  quicDecryptPacket,
  quicInitialSecrets,
  quicKeys,
  quicKeyUpdateSecret,
  quicLongHeader,
  quicOpenPacket,
  quicPacketNumberDecode,
  quicPacketNumberLength,
  quicParseHeader,
  quicRemoveHeaderProtection,
  quicRetryIntegrityTag,
  quicRetryPacket,
  quicRetryVerify,
  quicSealPacket,
  quicShortHeader,
  quicVarintLength,
  quicVarintPush,
  quicVarintPushSized,
  quicVarintRead,
  quicVarintSize
} from "nish/net/quic-packet";
import { bytesOf, flipped, hexOf, joined, prefix, zeros } from "./bytes";
import { a5Packet, a5Secret, clientDcid, initialOf, keysOf, orEmpty } from "./checks";
import { a2Packet, a3Packet, a4Retry } from "./vectors";

/** 21 bytes, one more than any version 1 connection ID may have. */
const longCid = (): u8[] => zeros(21);

/** A.5's keys, under which the open refusals damage A.5's packet one way at a time. */
const a5Keys = (): QuicKeys => keysOf(QUIC_AEAD_CHACHA20_POLY1305, a5Secret());

/** The error `quicParseHeader` stops at for `hex`, parsed from `at`. */
const parseError = (hex: string, at: i32, shortDcidLength: i32): i32 =>
  quicParseHeader(bytesOf(hex), at, shortDcidLength).error;

/** The error opening `datagram`'s first packet under `keys` stops at. */
const openError = (keys: QuicKeys, datagram: u8[], shortDcidLength: i32): i32 =>
  quicOpenPacket(keys, datagram, quicParseHeader(datagram, 0, shortDcidLength), -1).error;

/** RFC 9000 §16's range, and the reader's window. */
const varintRefusals = (t: Suite): void => {
  t.eqI32("a negative varint has no size", quicVarintSize(toI64(-1)), toI32(0));
  t.eqI32("nor has 2^62", quicVarintSize(QUIC_MAX_VARINT + 1), toI32(0));
  const out: u8[] = [];
  t.ok("2^62 is refused, appending nothing", !quicVarintPush(out, QUIC_MAX_VARINT + 1) && toI32(out.length) === 0);
  t.ok("a size of 3 is refused", !quicVarintPushSized(out, toI64(5), 3));
  t.ok("so is a size too short for the value", !quicVarintPushSized(out, toI64(64), 1));
  t.eqI32("and neither appended anything", toI32(out.length), toI32(0));
  const two: u8[] = bytesOf("7bbd");
  t.eqI64("a two-byte varint cut to one is refused", quicVarintRead(two, 0, 1), toI64(-1));
  t.eqI64("so is a window past the array", quicVarintRead(two, 0, 3), toI64(-1));
  t.eqI64("and a start outside it", quicVarintRead(two, 2, 2), toI64(-1));
  t.eqI32("a varint's length outside the array is 0, below", quicVarintLength(two, -1), toI32(0));
  t.eqI32("and above", quicVarintLength(two, 2), toI32(0));
};

/** RFC 9000 §17.1's ranges. */
const packetNumberRefusals = (t: Suite): void => {
  t.eqI32("no length for a negative packet number", quicPacketNumberLength(toI64(-1), toI64(-1)), toI32(0));
  t.eqI32("nor one past 2^62 - 1", quicPacketNumberLength(QUIC_MAX_VARINT + 1, toI64(-1)), toI32(0));
  t.eqI32("nor one at or below the largest acknowledged", quicPacketNumberLength(toI64(5), toI64(5)), toI32(0));
  t.eqI32("nor for a largest acknowledged below -1", quicPacketNumberLength(toI64(5), toI64(-2)), toI32(0));
  t.eqI32("nor for more than 2^31 unacknowledged", quicPacketNumberLength(2147483648, -1), toI32(0));
  t.eqI64("no decoding a 0-byte packet number", quicPacketNumberDecode(toI64(0), toI64(0), 0), toI64(-1));
  t.eqI64("nor a 5-byte one", quicPacketNumberDecode(toI64(0), toI64(0), 5), toI64(-1));
  t.eqI64("nor a truncated number wider than its length", quicPacketNumberDecode(toI64(0), toI64(256), 1), toI64(-1));
  t.eqI64("nor a negative one", quicPacketNumberDecode(toI64(0), toI64(-1), 1), toI64(-1));
  t.eqI64("nor against a largest below -1", quicPacketNumberDecode(toI64(-2), toI64(0), 1), toI64(-1));
  t.eqI64("nor against a largest past 2^62 - 1", quicPacketNumberDecode(QUIC_MAX_VARINT + 1, toI64(0), 1), toI64(-1));
};

/** Every way a datagram's header can fail to parse (RFC 9000 §17, RFC 8999 §5). */
const parseRefusals = (t: Suite): void => {
  t.eqI32("an empty datagram is truncated", parseError("", 0, 0), QUIC_ERR_TRUNCATED);
  t.eqI32("so is a start before it", parseError("40", -1, 0), QUIC_ERR_TRUNCATED);
  t.eqI32("and a start at its end", parseError("40", 1, 0), QUIC_ERR_TRUNCATED);
  t.eqI32("a short header with the fixed bit clear", parseError("00000000000000000000", 0, 0), QUIC_ERR_FIXED_BIT);
  t.eqI32("a short header shorter than its DCID", parseError("4000000000", 0, 8), QUIC_ERR_TRUNCATED);
  t.eqI32("a short-header DCID length over 20", parseError("40000000000000000000", 0, 21), QUIC_ERR_TRUNCATED);
  t.eqI32("a negative short-header DCID length", parseError("40000000000000000000", 0, -1), QUIC_ERR_TRUNCATED);
  t.eqI32("a long header cut inside its version", parseError("c0000000", 0, 0), QUIC_ERR_TRUNCATED);
  t.eqI32("cut before its DCID length", parseError("c000000001", 0, 0), QUIC_ERR_TRUNCATED);
  t.eqI32("cut inside its DCID", parseError("c00000000108aabb", 0, 0), QUIC_ERR_TRUNCATED);
  t.eqI32("cut before its SCID length", parseError("c00000000100", 0, 0), QUIC_ERR_TRUNCATED);
  t.eqI32("cut inside its SCID", parseError("c0000000010004aa", 0, 0), QUIC_ERR_TRUNCATED);

  const draft: QuicHeader = quicParseHeader(bytesOf("c0ff00001d04aabbccdd02eeff00"), 0, 0);
  t.eqI32("draft-29's version is not spoken", draft.error, QUIC_ERR_VERSION);
  t.eqStr(
    "but its version and connection IDs are read, for Version Negotiation",
    `${draft.version} ${hexOf(draft.dcid)} ${hexOf(draft.scid)}`,
    "4278190109 aabbccdd eeff"
  );
  const negotiation: QuicHeader = quicParseHeader(bytesOf("80000000000000"), 0, 0);
  t.eqStr("version 0, Version Negotiation itself, likewise", `${negotiation.error} ${negotiation.version}`, `${QUIC_ERR_VERSION} 0`);
  const wide: u8[] = joined(joined(bytesOf("c0ff00001d15"), longCid()), bytesOf("00"));
  t.eqI32("another version may have a 21-byte DCID (RFC 8999)", toI32(quicParseHeader(wide, 0, 0).dcid.length), toI32(21));

  t.eqI32("a version 1 long header with the fixed bit clear", parseError("800000000100000000", 0, 0), QUIC_ERR_FIXED_BIT);
  const v1Dcid: u8[] = joined(joined(bytesOf("c00000000115"), longCid()), bytesOf("00000000"));
  t.eqI32("a version 1 DCID of 21 bytes", quicParseHeader(v1Dcid, 0, 0).error, QUIC_ERR_CID_LENGTH);
  const v1Scid: u8[] = joined(joined(bytesOf("c0000000010015"), longCid()), bytesOf("000000"));
  t.eqI32("a version 1 SCID of 21 bytes", quicParseHeader(v1Scid, 0, 0).error, QUIC_ERR_CID_LENGTH);
  t.eqI32("a Retry shorter than its tag", parseError("f0000000010000000102030405060708090a0b0c0d0e", 0, 0), QUIC_ERR_TRUNCATED);
  t.eqI32("an Initial cut before its token length", parseError("c0000000010000", 0, 0), QUIC_ERR_TRUNCATED);
  t.eqI32("an Initial cut inside a two-byte token length", parseError("c000000001000040", 0, 0), QUIC_ERR_TRUNCATED);
  t.eqI32("an Initial whose token runs past the datagram", parseError("c00000000100000580aabb", 0, 0), QUIC_ERR_TRUNCATED);
  t.eqI32("a Handshake cut before its Length", parseError("e0000000010000", 0, 0), QUIC_ERR_TRUNCATED);
  t.eqI32("a Handshake whose Length passes the datagram", parseError("e00000000100000a0102", 0, 0), QUIC_ERR_LENGTH);
  t.eqI32("A.2 one byte short of its Length", quicParseHeader(prefix(bytesOf(a2Packet()), 1199), 0, 8).error, QUIC_ERR_LENGTH);
};

/** Every way opening a packet can stop (RFC 9001 §5.3-§5.4, RFC 9000 §17.2). */
const openRefusals = (t: Suite): void => {
  const keys: QuicKeys = a5Keys();
  const retry: u8[] = bytesOf(a4Retry());
  t.eqI32("a Retry carries nothing to open", openError(keys, retry, 0), QUIC_ERR_NOT_PROTECTED);
  t.eqI32("nor does a header that did not parse", openError(keys, bytesOf("00"), 0), QUIC_ERR_NOT_PROTECTED);
  t.eqI32("a packet one byte short of a sample", openError(keys, prefix(a5Packet(), 20), 0), QUIC_ERR_SAMPLE);
  const shortLength: u8[] = joined(bytesOf("e00000000100001300"), zeros(18));
  t.eqI32("a Handshake whose Length leaves no room for the sample", openError(keys, shortLength, 0), QUIC_ERR_SAMPLE);
  t.eqI32(
    "a header built by hand, with no packet number after its start",
    quicOpenPacket(keys, a5Packet(), new QuicHeader(), -1).error,
    QUIC_ERR_SAMPLE
  );
  const longer: QuicHeader = quicParseHeader(bytesOf(a3Packet()), 0, 0);
  t.eqI32("a header read from a longer datagram", quicOpenPacket(keys, a5Packet(), longer, -1).error, QUIC_ERR_SAMPLE);
  t.eqI32("a flipped ciphertext byte", openError(keys, flipped(a5Packet(), 10, 1), 0), QUIC_ERR_DECRYPT);
  const server: QuicKeys = keysOf(QUIC_AEAD_AES_128_GCM, initialOf(clientDcid()).server);
  t.eqI32("A.2 under the server's Initial keys", openError(server, bytesOf(a2Packet()), 8), QUIC_ERR_DECRYPT);
  t.eqI32("keys quicKeys did not make", openError(new QuicKeys(0, [], [], []), a5Packet(), 0), QUIC_ERR_DECRYPT);
  const noPacketKey: QuicKeys = new QuicKeys(QUIC_AEAD_AES_128_GCM, server.key, server.iv, server.hp);
  noPacketKey.hpAes = server.hpAes;
  t.eqI32("AES keys with no packet key expanded", openError(noPacketKey, bytesOf(a2Packet()), 8), QUIC_ERR_DECRYPT);

  const failed: QuicPacket = quicRemoveHeaderProtection(keys, retry, quicParseHeader(retry, 0, 0), -1);
  t.ok("a packet already in error is not decrypted", !quicDecryptPacket(keys, retry, quicParseHeader(retry, 0, 0), failed));
  t.eqI32("and keeps its error", failed.error, QUIC_ERR_NOT_PROTECTED);

  // Reserved bits are only known once header protection is off, and RFC 9000
  // §17.2 makes them a connection error only for a packet that authenticates.
  const longHeader: u8[] = orEmpty(quicLongHeader(QUIC_PACKET_HANDSHAKE, clientDcid(), [], [], toI64(1), 2, 4));
  longHeader[0] = longHeader[0] | toU8(0x04);
  const longSealed: u8[] = orEmpty(quicSealPacket(keys, longHeader, toI64(1), bytesOf("01000000")));
  const longOpened: QuicPacket = quicOpenPacket(keys, longSealed, quicParseHeader(longSealed, 0, 0), toI64(0));
  t.eqStr(
    "a long header's reserved bit, once the packet authenticates",
    `${longOpened.error} ${hexOf(longOpened.payload)}`,
    `${QUIC_ERR_RESERVED_BITS} 01000000`
  );
  const shortHeader: u8[] = orEmpty(quicShortHeader([], false, false, toI64(1), 1));
  shortHeader[0] = shortHeader[0] | toU8(0x10);
  const shortSealed: u8[] = orEmpty(quicSealPacket(keys, shortHeader, toI64(1), bytesOf("010000")));
  t.eqI32("and a short header's", openError(keys, shortSealed, 0), QUIC_ERR_RESERVED_BITS);
};

/** The builders' `null`s, for arguments out of range. */
const builderRefusals = (t: Suite): void => {
  const one: i64 = 1;
  t.ok("no long header of type Retry", quicLongHeader(QUIC_PACKET_RETRY, [], [], [], one, 1, 4) === null);
  t.ok("nor of the short type", quicLongHeader(QUIC_PACKET_SHORT, [], [], [], one, 1, 4) === null);
  t.ok("nor a Handshake with a token", quicLongHeader(QUIC_PACKET_HANDSHAKE, [], [], bytesOf("aa"), one, 1, 4) === null);
  t.ok("nor a 21-byte DCID", quicLongHeader(QUIC_PACKET_INITIAL, longCid(), [], [], one, 1, 4) === null);
  t.ok("nor a 21-byte SCID", quicLongHeader(QUIC_PACKET_INITIAL, [], longCid(), [], one, 1, 4) === null);
  t.ok("nor a 0-byte packet number", quicLongHeader(QUIC_PACKET_INITIAL, [], [], [], one, 0, 4) === null);
  t.ok("nor a 5-byte one", quicLongHeader(QUIC_PACKET_INITIAL, [], [], [], one, 5, 4) === null);
  t.ok("nor a negative packet number", quicLongHeader(QUIC_PACKET_INITIAL, [], [], [], toI64(-1), 1, 4) === null);
  t.ok("nor one past 2^62 - 1", quicLongHeader(QUIC_PACKET_INITIAL, [], [], [], QUIC_MAX_VARINT + 1, 1, 4) === null);
  t.ok("nor a negative payload length", quicLongHeader(QUIC_PACKET_INITIAL, [], [], [], one, 1, -1) === null);
  t.ok("no short header with a 21-byte DCID", quicShortHeader(longCid(), false, false, one, 1) === null);
  t.ok("nor a 0-byte packet number", quicShortHeader([], false, false, one, 0) === null);
  t.ok("nor a 5-byte one", quicShortHeader([], false, false, one, 5) === null);
  t.ok("nor a negative packet number", quicShortHeader([], false, false, toI64(-1), 1) === null);
  t.ok("nor one past 2^62 - 1", quicShortHeader([], false, false, QUIC_MAX_VARINT + 1, 1) === null);

  t.ok("no Initial secrets for a 21-byte DCID", quicInitialSecrets(longCid()) === null);
  t.ok("no keys for an AEAD this module does not know", quicKeys(99, zeros(32)) === null);
  t.ok("nor for AES-128-GCM from a 48-byte secret", quicKeys(QUIC_AEAD_AES_128_GCM, zeros(48)) === null);
  t.ok("nor for AES-256-GCM from a 32-byte one", quicKeys(QUIC_AEAD_AES_256_GCM, zeros(32)) === null);
  t.ok("nor for ChaCha20-Poly1305 from 31 bytes", quicKeys(QUIC_AEAD_CHACHA20_POLY1305, zeros(31)) === null);
  t.ok("no key update for an unknown AEAD", quicKeyUpdateSecret(99, zeros(32)) === null);
  t.ok("nor from a secret of the wrong length", quicKeyUpdateSecret(QUIC_AEAD_AES_128_GCM, zeros(31)) === null);

  const keys: QuicKeys = a5Keys();
  const header: u8[] = orEmpty(quicShortHeader([], false, false, one, 1));
  t.ok("no seal of a one-byte header", quicSealPacket(keys, bytesOf("40"), one, zeros(4)) === null);
  t.ok("nor of a header shorter than its packet number", quicSealPacket(keys, bytesOf("4300"), one, zeros(4)) === null);
  t.ok("nor of a payload too short to sample", quicSealPacket(keys, header, one, zeros(2)) === null);
  t.ok("but three bytes with a one-byte number is enough", quicSealPacket(keys, header, one, zeros(3)) !== null);
  t.ok("nor of a negative packet number", quicSealPacket(keys, header, toI64(-1), zeros(4)) === null);
  t.ok("nor of one past 2^62 - 1", quicSealPacket(keys, header, QUIC_MAX_VARINT + 1, zeros(4)) === null);
  t.ok("nor under keys quicKeys did not make", quicSealPacket(new QuicKeys(0, [], [], []), header, one, zeros(4)) === null);
  const aes: QuicKeys = keysOf(QUIC_AEAD_AES_128_GCM, initialOf(clientDcid()).client);
  const noHp: QuicKeys = new QuicKeys(QUIC_AEAD_AES_128_GCM, aes.key, aes.iv, aes.hp);
  noHp.packetAes = aesKey(aes.key);
  t.ok("nor under AES keys with no header-protection key expanded", quicSealPacket(noHp, header, one, zeros(4)) === null);

  t.ok("no Retry tag for a 21-byte original DCID", quicRetryIntegrityTag(longCid(), []) === null);
  const token: u8[] = bytesOf("746f6b656e");
  t.ok("no Retry with a 21-byte DCID", quicRetryPacket(longCid(), [], token, clientDcid(), 0) === null);
  t.ok("nor a 21-byte SCID", quicRetryPacket([], longCid(), token, clientDcid(), 0) === null);
  t.ok("nor an empty token", quicRetryPacket([], [], [], clientDcid(), 0) === null);
  t.ok("nor unused bits below 0", quicRetryPacket([], [], token, clientDcid(), -1) === null);
  t.ok("nor above 15", quicRetryPacket([], [], token, clientDcid(), 16) === null);
  t.ok("nor a 21-byte original DCID", quicRetryPacket([], [], token, longCid(), 0) === null);

  const retry: u8[] = bytesOf(a4Retry());
  const parsed: QuicHeader = quicParseHeader(retry, 0, 0);
  t.ok("a Retry with one byte of its token changed does not verify", !quicRetryVerify(clientDcid(), flipped(retry, 16, 1), parsed));
  t.ok("nor with a byte of its tag changed", !quicRetryVerify(clientDcid(), retry, quicParseHeader(flipped(retry, 35, 1), 0, 0)));
  t.ok("nor against a 21-byte original DCID", !quicRetryVerify(longCid(), retry, parsed));
  const initial: u8[] = bytesOf(a2Packet());
  t.ok("an Initial is not a Retry", !quicRetryVerify(clientDcid(), initial, quicParseHeader(initial, 0, 8)));
  t.ok("nor is a header that did not parse", !quicRetryVerify(clientDcid(), retry, quicParseHeader(bytesOf("00"), 0, 0)));
  t.eqI32("a Retry with an empty token still parses (the client discards it)", parseError(`f0000000010000${hexOf(zeros(16))}`, 0, 0), QUIC_PACKET_OK);
};

/** Every refusal, in the order the module's header lists them. */
export const refusalChecks = (t: Suite): void => {
  varintRefusals(t);
  packetNumberRefusals(t);
  parseRefusals(t);
  openRefusals(t);
  builderRefusals(t);
};
