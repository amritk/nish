// `nish/net/quic-packet` against the published answers: RFC 9000 Appendix
// A.1-A.3's varint and packet-number examples, and RFC 9001 Appendix A's
// keys and packets, each built and opened byte for byte (A.1 keys, A.2 the
// client Initial, A.3 the server Initial, A.4 the Retry, A.5 the ChaCha20
// short header). RFC 9001 prints no AES-256-GCM packet, so that one was made
// by a direct transcription of RFC 9001 §5 over Python's `hmac` and the
// `cryptography` package's AES-GCM and AES-ECB, and is marked so.
import { Suite } from "nish/testing";
import {
  QUIC_AEAD_AES_128_GCM,
  QUIC_AEAD_AES_256_GCM,
  QUIC_AEAD_CHACHA20_POLY1305,
  QUIC_ERR_DECRYPT,
  QUIC_MAX_VARINT,
  QUIC_PACKET_HANDSHAKE,
  QUIC_PACKET_INITIAL,
  QUIC_PACKET_OK,
  QUIC_PACKET_RETRY,
  QUIC_PACKET_SHORT,
  QUIC_PACKET_ZERO_RTT,
  QUIC_VERSION_1,
  QuicHeader,
  QuicInitialSecrets,
  QuicKeys,
  QuicPacket,
  quicDecryptPacket,
  quicInitialSecrets,
  quicKeys,
  quicKeyUpdateSecret,
  quicKeysUpdate,
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
import { bytesOf, hexOf, hexOrNull, joined, zeros } from "./bytes";
import { a2Packet, a2Payload, a3Packet, a3Payload, a4Retry } from "./vectors";

/** RFC 9001 Appendix A's client-chosen Destination Connection ID. */
export const clientDcid = (): u8[] => bytesOf("8394c8f03e515708");

/** A.3 and A.4's server connection ID. */
const serverCid = (): u8[] => bytesOf("f067a5502a4262b5");

/** A.5's application traffic secret. */
export const a5Secret = (): u8[] => bytesOf("9ac312a7f877468ebe69422748ad00a15443f18203a07d6060f688f30f21632b");

/** The A.5 packet: one PING frame, packet number 654360564 in three bytes, empty DCID. */
export const a5Packet = (): u8[] => bytesOf("4cfe4189655e5cd55c41f69080575d7999c25a5bfb");

/** The keys for `secret`, or keys that fail every operation when `quicKeys` refuses. */
export const keysOf = (aead: i32, secret: u8[]): QuicKeys => {
  const keys: QuicKeys | null = quicKeys(aead, secret);
  if (keys !== null) {
    return keys;
  }
  return new QuicKeys(0, [], [], []);
};

/** The Initial secrets for `dcid`, or empty ones when it is refused. */
export const initialOf = (dcid: u8[]): QuicInitialSecrets => {
  const secrets: QuicInitialSecrets | null = quicInitialSecrets(dcid);
  if (secrets !== null) {
    return secrets;
  }
  return new QuicInitialSecrets([], []);
};

/** A builder's answer, or an empty array for `null`. */
export const orEmpty = (bytes: u8[] | null): u8[] => {
  if (bytes !== null) {
    return bytes;
  }
  return [];
};

/** The varint encoding of `value` as hex, or "refused". */
const varintHex = (value: i64): string => {
  const out: u8[] = [];
  if (!quicVarintPush(out, value)) {
    return "refused";
  }
  return hexOf(out);
};

/** The varint at the start of `hex`, decoded, and its length, as "value/length". */
const varintOf = (hex: string): string => {
  const bytes: u8[] = bytesOf(hex);
  return `${quicVarintRead(bytes, 0, toI32(bytes.length))}/${quicVarintLength(bytes, 0)}`;
};

/** RFC 9000 §16 and Appendix A.1. */
const varintChecks = (t: Suite): void => {
  t.eqStr("A.1: 0xc2197c5eff14e88c decodes to 151,288,809,941,952,652", varintOf("c2197c5eff14e88c"), "151288809941952652/8");
  t.eqStr("A.1: 0x9d7f3e7d decodes to 494,878,333", varintOf("9d7f3e7d"), "494878333/4");
  t.eqStr("A.1: 0x7bbd decodes to 15,293", varintOf("7bbd"), "15293/2");
  t.eqStr("A.1: 0x25 decodes to 37", varintOf("25"), "37/1");
  t.eqStr("A.1: 0x4025 decodes to 37 as well", varintOf("4025"), "37/2");
  const big: i64 = (toI64(0x02197c5e) << 32) | ( toI64(0xff14) << 16) | toI64(0xe88c);
  t.eqStr("A.1: 151,288,809,941,952,652 encodes to 0xc2197c5eff14e88c", varintHex(big), "c2197c5eff14e88c");
  t.eqStr("A.1: 494,878,333 encodes to 0x9d7f3e7d", varintHex(494878333), "9d7f3e7d");
  t.eqStr("A.1: 15,293 encodes to 0x7bbd", varintHex(15293), "7bbd");
  t.eqStr("A.1: 37 encodes to 0x25, the shortest form", varintHex(37), "25");
  const sized: u8[] = [];
  t.ok("37 in two bytes is accepted", quicVarintPushSized(sized, 37, 2));
  t.eqStr("and is A.1's 0x4025", hexOf(sized), "4025");
  t.eqStr("each length's boundaries: 63 and 64", `${varintHex(63)} ${varintHex(64)}`, "3f 4040");
  t.eqStr("16383 and 16384", `${varintHex(16383)} ${varintHex(16384)}`, "7fff 80004000");
  t.eqStr("2^30 - 1 and 2^30", `${varintHex(1073741823)} ${varintHex(1073741824)}`, "bfffffff c000000040000000");
  t.eqStr("2^62 - 1, the largest", varintHex(QUIC_MAX_VARINT), "ffffffffffffffff");
  t.eqI32("quicVarintSize of 2^62 - 1 is 8", quicVarintSize(QUIC_MAX_VARINT), toI32(8));
  const max: u8[] = bytesOf("ffffffffffffffff");
  t.eqI64("0xffffffffffffffff decodes to 2^62 - 1", quicVarintRead(max, 0, 8), QUIC_MAX_VARINT);
  const two: u8[] = bytesOf("25407bbd");
  t.eqI64("a varint read at an offset", quicVarintRead(two, 2, 4), toI64(15293));
}

/** RFC 9000 §17.1 and Appendix A.2-A.3. */
const packetNumberChecks = (t: Suite): void => {
  t.eqI32("A.2: 0xac5c02 after 0xabe8b3 acknowledged takes 16 bits", quicPacketNumberLength(0xac5c02, 0xabe8b3), toI32(2));
  t.eqI32("A.2: 0xace8fe in the same state takes 24 bits", quicPacketNumberLength(0xace8fe, 0xabe8b3), toI32(3));
  t.eqI32("packet 0 with nothing acknowledged takes 8 bits", quicPacketNumberLength(0, -1), toI32(1));
  t.eqI32("128 unacknowledged still fit 8 bits", quicPacketNumberLength(127, -1), toI32(1));
  t.eqI32("129 take 16", quicPacketNumberLength(128, -1), toI32(2));
  t.eqI32("2^31 unacknowledged take 32 bits", quicPacketNumberLength(2147483648, 0), toI32(4));
  const a3: i64 = (toI64(0xa82f) << 16) | toI64(0x30ea);
  const a3Want: i64 = (toI64(0xa82f) << 16) | toI64(0x9b32);
  t.eqI64("A.3: 0x9b32 after 0xa82f30ea decodes to 0xa82f9b32", quicPacketNumberDecode(a3, 0x9b32, 2), a3Want);
  t.eqI64("decoding wraps up a window: 0x01 after 0xff is 0x101", quicPacketNumberDecode(0xff, 0x01, 1), toI64(0x101));
  t.eqI64("and down a window: 0xff after 0x101 is 0xff", quicPacketNumberDecode(0x101, 0xff, 1), toI64(0xff));
  t.eqI64("the first packet of a space: 0 with nothing processed", quicPacketNumberDecode(-1, 0, 1), toI64(0));
  t.eqI64(
    "near 2^62 the window does not go up past the largest packet number",
    quicPacketNumberDecode(QUIC_MAX_VARINT - 1, 0x00, 1),
    QUIC_MAX_VARINT - 255
  );
  t.eqI64(
    "at the top of the space, 0x00 after 2^62 - 1 is 2^62 - 256, not 2^62",
    quicPacketNumberDecode(QUIC_MAX_VARINT, 0x00, 1),
    QUIC_MAX_VARINT - 255
  );
  t.eqI64(
    "0xff after 2^62 - 1 is 2^62 - 1 itself",
    quicPacketNumberDecode(QUIC_MAX_VARINT, 0xff, 1),
    QUIC_MAX_VARINT
  );
  t.eqI64(
    "0x80 after 2^62 - 1 is 2^62 - 128",
    quicPacketNumberDecode(QUIC_MAX_VARINT, 0x80, 1),
    QUIC_MAX_VARINT - 127
  );
  t.eqI64(
    "0xff after 2^62 - 2 is 2^62 - 1",
    quicPacketNumberDecode(QUIC_MAX_VARINT - 1, 0xff, 1),
    QUIC_MAX_VARINT
  );
  t.eqI64(
    "a four-byte 0 after 2^62 - 1 is 2^62 - 2^32",
    quicPacketNumberDecode(QUIC_MAX_VARINT, 0, 4),
    QUIC_MAX_VARINT - 4294967295
  );
  t.eqI64("and near 0 it does not go down below zero", quicPacketNumberDecode(0, 0xff, 1), toI64(0xff));
}

/** RFC 9001 A.1: the Initial secrets and keys for the client's DCID. */
const keyChecks = (t: Suite): void => {
  const secrets: QuicInitialSecrets = initialOf(clientDcid());
  t.eqStr(
    "A.1 client_initial_secret",
    hexOf(secrets.client),
    "c00cf151ca5be075ed0ebfb5c80323c42d6b7db67881289af4008f1f6c357aea"
  );
  t.eqStr(
    "A.1 server_initial_secret",
    hexOf(secrets.server),
    "3c199828fd139efd216c155ad844cc81fb82fa8d7446fa7d78be803acdda951b"
  );
  const client: QuicKeys = keysOf(QUIC_AEAD_AES_128_GCM, secrets.client);
  t.eqStr("A.1 client key", hexOf(client.key), "1f369613dd76d5467730efcbe3b1a22d");
  t.eqStr("A.1 client iv", hexOf(client.iv), "fa044b2f42a3fd3b46fb255c");
  t.eqStr("A.1 client hp", hexOf(client.hp), "9f50449e04a0e810283a1e9933adedd2");
  const server: QuicKeys = keysOf(QUIC_AEAD_AES_128_GCM, secrets.server);
  t.eqStr("A.1 server key", hexOf(server.key), "cf3a5331653c364c88f0f379b6067e37");
  t.eqStr("A.1 server iv", hexOf(server.iv), "0ac1493ca1905853b0bba03e");
  t.eqStr("A.1 server hp", hexOf(server.hp), "c206b8d9b9f0f37644430b490eeaa314");
  const chacha: QuicKeys = keysOf(QUIC_AEAD_CHACHA20_POLY1305, a5Secret());
  t.eqStr("A.5 key", hexOf(chacha.key), "c6d98ff3441c3fe1b2182094f69caa2ed4b716b65488960a7a984979fb23e1c8");
  t.eqStr("A.5 iv", hexOf(chacha.iv), "e0459b3474bdd0e44a41c144");
  t.eqStr("A.5 hp", hexOf(chacha.hp), "25a282b9e82f06f21f488917a4fc8f1b73573685608597d0efcb076b0ab7a7a4");
  t.eqStr(
    "A.5 ku, the next generation's secret",
    hexOrNull(quicKeyUpdateSecret(QUIC_AEAD_CHACHA20_POLY1305, a5Secret())),
    "1223504755036d556342ee9361d253421a826c9ecdf3c7148684b36b714881f9"
  );
}

/** A.2's payload: the CRYPTO frame and PADDING to 1162 bytes. */
const a2Frames = (): u8[] => {
  const frames: u8[] = bytesOf(a2Payload());
  return joined(frames, zeros(1162 - toI32(frames.length)));
}

/** RFC 9001 A.2: the client Initial. */
const clientInitialChecks = (t: Suite): void => {
  t.eqI32("A.2's printed packet is 1200 bytes", toI32(bytesOf(a2Packet()).length), toI32(1200));
  const keys: QuicKeys = keysOf(QUIC_AEAD_AES_128_GCM, initialOf(clientDcid()).client);
  const header: u8[] = orEmpty(quicLongHeader(QUIC_PACKET_INITIAL, clientDcid(), [], [], 2, 4, 1162));
  t.eqStr("A.2 unprotected header", hexOf(header), "c300000001088394c8f03e5157080000449e00000002");
  const sealed: u8[] = orEmpty(quicSealPacket(keys, header, 2, a2Frames()));
  t.eqStr("A.2 protected packet, byte for byte", hexOf(sealed), a2Packet());

  const datagram: u8[] = bytesOf(a2Packet());
  const parsed: QuicHeader = quicParseHeader(datagram, 0, 8);
  t.eqI32("A.2 parses", parsed.error, QUIC_PACKET_OK);
  t.eqI32("as an Initial", parsed.type, QUIC_PACKET_INITIAL);
  t.eqI64("of version 1", parsed.version, QUIC_VERSION_1);
  t.eqStr("to the client's DCID", hexOf(parsed.dcid), "8394c8f03e515708");
  t.eqStr("with an empty SCID and token", `${parsed.scid.length} ${parsed.token.length}`, "0 0");
  t.eqStr("its packet number at 18, and its end at the datagram's", `${parsed.pnOffset} ${parsed.end}`, "18 1200");
  const opened: QuicPacket = quicOpenPacket(keys, datagram, parsed, -1);
  t.eqI32("A.2 opens under the client's Initial keys", opened.error, QUIC_PACKET_OK);
  t.eqI64("packet number 2", opened.packetNumber, toI64(2));
  t.eqI32("sent in 4 bytes", opened.pnLength, toI32(4));
  t.eqStr("the header in the clear", hexOf(opened.header), "c300000001088394c8f03e5157080000449e00000002");
  t.eqStr("the payload, byte for byte", hexOf(opened.payload), hexOf(a2Frames()));
}

/** RFC 9001 A.3: the server Initial. */
const serverInitialChecks = (t: Suite): void => {
  const keys: QuicKeys = keysOf(QUIC_AEAD_AES_128_GCM, initialOf(clientDcid()).server);
  const payload: u8[] = bytesOf(a3Payload());
  const header: u8[] = orEmpty(
    quicLongHeader(QUIC_PACKET_INITIAL, [], serverCid(), [], 1, 2, toI32(payload.length))
  );
  t.eqStr("A.3 unprotected header", hexOf(header), "c1000000010008f067a5502a4262b50040750001");
  t.eqStr("A.3 protected packet, byte for byte", hexOrNull(quicSealPacket(keys, header, 1, payload)), a3Packet());

  const datagram: u8[] = bytesOf(a3Packet());
  const parsed: QuicHeader = quicParseHeader(datagram, 0, 8);
  t.eqI32("A.3 parses", parsed.error, QUIC_PACKET_OK);
  t.eqStr("with the server's SCID and an empty DCID", `${hexOf(parsed.scid)} ${parsed.dcid.length}`, "f067a5502a4262b5 0");
  const opened: QuicPacket = quicOpenPacket(keys, datagram, parsed, 0);
  t.eqI32("A.3 opens under the server's Initial keys", opened.error, QUIC_PACKET_OK);
  t.eqI64("packet number 1", opened.packetNumber, toI64(1));
  t.eqI32("sent in 2 bytes", opened.pnLength, toI32(2));
  t.eqStr("the payload, byte for byte", hexOf(opened.payload), a3Payload());
}

/** RFC 9001 A.4: the Retry. */
const retryChecks = (t: Suite): void => {
  const token: u8[] = bytesOf("746f6b656e");
  t.eqStr(
    "A.4 Retry, byte for byte",
    hexOrNull(quicRetryPacket([], serverCid(), token, clientDcid(), 15)),
    a4Retry()
  );
  const datagram: u8[] = bytesOf(a4Retry());
  t.eqStr(
    "A.4's integrity tag on its own",
    hexOrNull(quicRetryIntegrityTag(clientDcid(), bytesOf("ff000000010008f067a5502a4262b5746f6b656e"))),
    "04a265ba2eff4d829058fb3f0f2496ba"
  );
  const parsed: QuicHeader = quicParseHeader(datagram, 0, 8);
  t.eqI32("A.4 parses", parsed.error, QUIC_PACKET_OK);
  t.eqI32("as a Retry", parsed.type, QUIC_PACKET_RETRY);
  t.eqStr("whose token is \"token\"", hexOf(parsed.token), "746f6b656e");
  t.eqStr("and whose tag is the last 16 bytes", hexOf(parsed.retryTag), "04a265ba2eff4d829058fb3f0f2496ba");
  t.ok("A.4 verifies against the client's original DCID", quicRetryVerify(clientDcid(), datagram, parsed));
  t.ok("and not against another", !quicRetryVerify(serverCid(), datagram, parsed));
}

/** RFC 9001 A.5: the ChaCha20-Poly1305 short header. */
const shortHeaderChecks = (t: Suite): void => {
  const keys: QuicKeys = keysOf(QUIC_AEAD_CHACHA20_POLY1305, a5Secret());
  const header: u8[] = orEmpty(quicShortHeader([], false, false, 654360564, 3));
  t.eqStr("A.5 unprotected header", hexOf(header), "4200bff4");
  t.eqStr("A.5 packet, byte for byte", hexOrNull(quicSealPacket(keys, header, 654360564, [toU8(1)])), hexOf(a5Packet()));
  const parsed: QuicHeader = quicParseHeader(a5Packet(), 0, 0);
  t.eqI32("A.5 parses as a short header", parsed.type, QUIC_PACKET_SHORT);
  const opened: QuicPacket = quicOpenPacket(keys, a5Packet(), parsed, 654360563);
  t.eqI32("A.5 opens", opened.error, QUIC_PACKET_OK);
  t.eqI64("packet number 654360564", opened.packetNumber, toI64(654360564));
  t.eqStr("the payload is one PING", hexOf(opened.payload), "01");
  t.ok("key phase 0", !opened.keyPhase);
}

/**
 * RFC 9001 §6: a key update keeps the header-protection key and derives the
 * packet key and IV from A.5's `ku`. RFC 9001 prints the secret but not the
 * keys, so those were checked against Python.
 */
const keyUpdateChecks = (t: Suite): void => {
  const current: QuicKeys = keysOf(QUIC_AEAD_CHACHA20_POLY1305, a5Secret());
  const ku: u8[] = orEmpty(quicKeyUpdateSecret(QUIC_AEAD_CHACHA20_POLY1305, a5Secret()));
  const updated: QuicKeys | null = quicKeysUpdate(current, ku);
  if (updated === null) {
    t.fail("A.5's keys update", "quicKeysUpdate answered null");
    return;
  }
  const next: QuicKeys = updated;
  t.eqStr(
    "the next key (checked against Python)",
    hexOf(next.key),
    "777ec1a510f50ec05d08d554ea5ef34a42c12200bb0f5a59c95908c9cd9189d2"
  );
  t.eqStr("the next iv (checked against Python)", hexOf(next.iv), "4159d18afd0156a1e564d16c");
  t.eqStr("and the header-protection key is kept", hexOf(next.hp), hexOf(current.hp));
  const header: u8[] = orEmpty(quicShortHeader([], false, true, 654360565, 3));
  const datagram: u8[] = orEmpty(quicSealPacket(next, header, 654360565, [toU8(1)]));
  const parsed: QuicHeader = quicParseHeader(datagram, 0, 0);
  const packet: QuicPacket = quicRemoveHeaderProtection(current, datagram, parsed, 654360564);
  t.ok("the old generation's hp reads the new phase", packet.error === QUIC_PACKET_OK && packet.keyPhase);
  t.ok("the new generation decrypts it", quicDecryptPacket(next, datagram, parsed, packet));
  t.eqI32("and the old one does not", quicOpenPacket(current, datagram, parsed, 654360564).error, QUIC_ERR_DECRYPT);
};

/** RFC 9000 §12.2: a datagram of two coalesced packets is walked by each one's end. */
const coalescedChecks = (t: Suite): void => {
  const datagram: u8[] = joined(bytesOf(a3Packet()), a5Packet());
  const first: QuicHeader = quicParseHeader(datagram, 0, 0);
  t.eqStr("the first packet is A.3's Initial, ending at 135", `${first.type} ${first.end}`, `${QUIC_PACKET_INITIAL} 135`);
  const second: QuicHeader = quicParseHeader(datagram, first.end, 0);
  t.eqStr(
    "the second starts there and is A.5's short header, to the datagram's end",
    `${second.type} ${second.start} ${second.end}`,
    `${QUIC_PACKET_SHORT} 135 156`
  );
  const server: QuicKeys = keysOf(QUIC_AEAD_AES_128_GCM, initialOf(clientDcid()).server);
  const a: QuicPacket = quicOpenPacket(server, datagram, first, -1);
  t.eqStr("the Initial opens where it lies", `${a.error} ${hexOf(a.payload)}`, `${QUIC_PACKET_OK} ${a3Payload()}`);
  // The header-protection key never changes with a key update, so it comes
  // off first, and the key phase names which generation decrypts.
  const chacha: QuicKeys = keysOf(QUIC_AEAD_CHACHA20_POLY1305, a5Secret());
  const b: QuicPacket = quicRemoveHeaderProtection(chacha, datagram, second, 654360563);
  t.ok("the short packet's key phase reads before it is decrypted", b.error === QUIC_PACKET_OK && !b.keyPhase);
  t.ok("and it then decrypts in place", quicDecryptPacket(chacha, datagram, second, b));
  t.eqStr("to A.5's PING", hexOf(b.payload), "01");
}

/** One long-header type through build, seal, parse and open. */
const roundTripLong = (t: Suite, keys: QuicKeys, frames: u8[], type: i32): void => {
  const token: u8[] = type === QUIC_PACKET_INITIAL ? bytesOf("abcdef") : [];
  const header: u8[] = orEmpty(quicLongHeader(type, clientDcid(), serverCid(), token, 70000, 3, 5));
  const datagram: u8[] = orEmpty(quicSealPacket(keys, header, 70000, frames));
  const parsed: QuicHeader = quicParseHeader(datagram, 0, 8);
  const opened: QuicPacket = quicOpenPacket(keys, datagram, parsed, 69999);
  t.eqStr(
    `type ${type}: built, sealed, parsed and opened`,
    `${parsed.type} ${hexOf(parsed.token)} ${opened.error} ${opened.packetNumber} ${hexOf(opened.payload)}`,
    `${type} ${hexOf(token)} ${QUIC_PACKET_OK} 70000 0100000000`
  );
};

/** Every type a long header carries, and a short header with both its bits set. */
const roundTripChecks = (t: Suite): void => {
  const keys: QuicKeys = keysOf(QUIC_AEAD_AES_128_GCM, initialOf(clientDcid()).client);
  const frames: u8[] = bytesOf("0100000000");
  roundTripLong(t, keys, frames, QUIC_PACKET_INITIAL);
  roundTripLong(t, keys, frames, QUIC_PACKET_ZERO_RTT);
  roundTripLong(t, keys, frames, QUIC_PACKET_HANDSHAKE);
  const keyPhase: u8[] = orEmpty(quicShortHeader(serverCid(), true, true, 5, 1));
  t.eqStr("a short header with the spin and key-phase bits", hexOf(keyPhase), "64f067a5502a4262b505");
  const datagram: u8[] = orEmpty(quicSealPacket(keys, keyPhase, 5, frames));
  const opened: QuicPacket = quicOpenPacket(keys, datagram, quicParseHeader(datagram, 0, 8), 4);
  t.ok("opens with key phase 1", opened.error === QUIC_PACKET_OK && opened.keyPhase);
  t.eqI32("and its first byte back in the clear", opened.firstByte, toI32(0x64));
}

/** AES-256-GCM, whose packet RFC 9001 does not print: checked against Python. */
const aes256Checks = (t: Suite): void => {
  const secret: u8[] = [];
  for (let k: i32 = 1; k <= 48; k += 1) {
    secret.push(toU8(k));
  }
  const keys: QuicKeys = keysOf(QUIC_AEAD_AES_256_GCM, secret);
  t.eqStr(
    "AES-256-GCM key, SHA-384 (checked against Python)",
    hexOf(keys.key),
    "4c44e9d10b4b7a239d81c815d42ceb9cfe026cd3a17bd55099b83e56b636afae"
  );
  t.eqStr("AES-256-GCM iv (checked against Python)", hexOf(keys.iv), "914a3f6ca07e7508c9a90fd8");
  t.eqStr(
    "AES-256-GCM hp (checked against Python)",
    hexOf(keys.hp),
    "c5ffe6d1b4768fc35e6f1d9789c3247827bb2894c244f33a5ca82045fcf3ae55"
  );
  t.eqStr(
    "AES-256-GCM ku, 48 bytes (checked against Python)",
    hexOrNull(quicKeyUpdateSecret(QUIC_AEAD_AES_256_GCM, secret)),
    "a1b5bda255f07b68dbe0a0398694d90de1f946e468f687eb19225c9245e1f4e41773f6465cb224e05db0407a9b6747d1"
  );
  const header: u8[] = orEmpty(quicShortHeader(bytesOf("0102030405060708"), false, true, 0x1234, 2));
  t.eqStr("its short header", hexOf(header), "4501020304050607081234");
  const frames: u8[] = joined([toU8(1)], zeros(20));
  const want: string =
    "4001020304050607081fae279e6da3e93047e3aedfacb9533515eaf41271be6db28586dc36a06261995bb0c7f32e6ba9";
  t.eqStr("its packet, byte for byte (checked against Python)", hexOrNull(quicSealPacket(keys, header, 0x1234, frames)), want);
  const opened: QuicPacket = quicOpenPacket(keys, bytesOf(want), quicParseHeader(bytesOf(want), 0, 8), 0x1200);
  t.eqStr("and it opens", `${opened.error} ${opened.packetNumber} ${hexOf(opened.payload)}`, `0 4660 ${hexOf(frames)}`);
}

/** Every check against a published or cross-checked answer. */
export const vectorChecks = (t: Suite): void => {
  varintChecks(t);
  packetNumberChecks(t);
  keyChecks(t);
  clientInitialChecks(t);
  serverInitialChecks(t);
  retryChecks(t);
  shortHeaderChecks(t);
  keyUpdateChecks(t);
  coalescedChecks(t);
  roundTripChecks(t);
  aes256Checks(t);
};
