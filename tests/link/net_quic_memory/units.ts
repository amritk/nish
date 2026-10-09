// The in-place forms a connection slot derives and encodes with, each held to
// the allocating form it replaces, byte for byte, and each refusal reached:
// `quicInitialSecretsInto`, `quicKeysInto`, `quicKeysUpdateInto` and
// `quicKeyUpdateSecretInto` in `nish/net/quic-packet` with the
// `QuicKeysSlot` they write into, and `quicEncodeTransportParametersInto` /
// `quicParseTransportParametersInto` in `nish/net/quic-conn-params`.
import { Suite } from "nish/testing";
import { HkdfScratch } from "nish/crypto/hkdf";
import { AesKey } from "nish/crypto/aes";
import {
  QUIC_AEAD_AES_128_GCM,
  QUIC_AEAD_AES_256_GCM,
  QUIC_AEAD_CHACHA20_POLY1305,
  QuicInitialSecrets,
  QuicKeys,
  QuicKeysSlot,
  quicInitialSecrets,
  quicInitialSecretsInto,
  quicKeyUpdateSecret,
  quicKeyUpdateSecretInto,
  quicKeys,
  quicKeysInto,
  quicKeysUpdate,
  quicKeysUpdateInto,
} from "nish/net/quic-packet";
import { QUIC_ERROR_NO_ERROR, QUIC_ERROR_TRANSPORT_PARAMETER } from "nish/net/quic-frame";
import {
  QuicTransportParameters,
  quicEncodeTransportParameters,
  quicEncodeTransportParametersInto,
  quicParseTransportParametersInto,
} from "nish/net/quic-conn-params";
import { fromHex, sameBytes } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";

/** Whether two AES keys, both present or both absent, hold the same schedule and hash key. */
const qmSameAes = (a: AesKey | null, b: AesKey | null): boolean => {
  if (a === null || b === null) {
    return a === null && b === null;
  }
  if (a.rounds !== b.rounds || a.hHi !== b.hHi || a.hLo !== b.hLo || toI32(a.roundKeys.length) !== toI32(b.roundKeys.length)) {
    return false;
  }
  for (let k: i32 = 0; k < toI32(a.roundKeys.length) && k < toI32(b.roundKeys.length); k++) {
    if (a.roundKeys[k] !== b.roundKeys[k]) {
      return false;
    }
  }
  return true;
};

/** Whether `got` holds what `want`, made by the allocating form, holds. */
const qmSameKeys = (got: QuicKeys | null, want: QuicKeys | null): boolean => {
  if (got === null || want === null) {
    return false;
  }
  return (
    got.aead === want.aead &&
    sameBytes(got.key, want.key) &&
    sameBytes(got.iv, want.iv) &&
    sameBytes(got.hp, want.hp) &&
    qmSameAes(got.packetAes, want.packetAes) &&
    qmSameAes(got.hpAes, want.hpAes)
  );
};

/** Whether every byte of `bytes` is zero. */
export const qmZero = (bytes: u8[]): boolean => {
  for (const b of bytes) {
    if (b !== toU8(0)) {
      return false;
    }
  }
  return true;
};

/** Whether every word of an AES schedule, and its hash key, is zero. */
const qmZeroAes = (key: AesKey): boolean => {
  for (const w of key.roundKeys) {
    if (w !== toU64(0)) {
      return false;
    }
  }
  return key.hHi === toU64(0) && key.hLo === toU64(0);
};

/** RFC 9001 Appendix A.1's client DCID. */
const qmDcid = (): u8[] => fromHex("8394c8f03e515708");

/** The Initial secrets and the three suites' keys, into one slot after another. */
const keyChecks = (t: Suite): void => {
  const kdf = new HkdfScratch();
  const want: QuicInitialSecrets | null = quicInitialSecrets(qmDcid());
  // The DCID read in place, from the middle of a datagram.
  const datagram: u8[] = fromHex("c300000001088394c8f03e515708ff");
  const client: u8[] = new Array<u8>(32);
  const server: u8[] = new Array<u8>(32);
  const made: boolean = quicInitialSecretsInto(kdf, datagram, n32(6), n32(8), client, server);
  t.ok(
    "quicInitialSecretsInto reads the DCID in place: RFC 9001 A.1's client and server secrets, as quicInitialSecrets has them",
    made && want !== null && sameBytes(client, want.client) && sameBytes(server, want.server)
  );
  const long: u8[] = new Array<u8>(21);
  t.ok("it refuses a DCID over 20 bytes", !quicInitialSecretsInto(kdf, long, n32(0), n32(21), client, server));
  t.ok("a window outside the datagram", !quicInitialSecretsInto(kdf, datagram, n32(10), n32(8), client, server));
  t.ok("and an output that is not 32 bytes", !quicInitialSecretsInto(kdf, datagram, n32(6), n32(8), new Array<u8>(48), server));

  // One slot, three suites in turn: what the last left is overwritten whole.
  const slot = new QuicKeysSlot();
  const secret32: u8[] = server;
  const longSecret: u8[] = [];
  for (let k: i32 = 0; k < 48; k++) {
    longSecret.push(toU8(k * 5 + 1));
  }
  const aes256: QuicKeys | null = quicKeysInto(kdf, slot, QUIC_AEAD_AES_256_GCM, longSecret);
  t.ok("quicKeysInto under AES-256-GCM is quicKeys, schedules included", qmSameKeys(aes256, quicKeys(QUIC_AEAD_AES_256_GCM, longSecret)));
  const chacha: QuicKeys | null = quicKeysInto(kdf, slot, QUIC_AEAD_CHACHA20_POLY1305, secret32);
  t.ok("then in the same slot under ChaCha20-Poly1305, with no schedules", qmSameKeys(chacha, quicKeys(QUIC_AEAD_CHACHA20_POLY1305, secret32)));
  const aes128: QuicKeys | null = quicKeysInto(kdf, slot, QUIC_AEAD_AES_128_GCM, secret32);
  t.ok("then under AES-128-GCM", qmSameKeys(aes128, quicKeys(QUIC_AEAD_AES_128_GCM, secret32)));
  t.ok("quicKeysInto refuses an AEAD it does not know", quicKeysInto(kdf, slot, n32(9), secret32) === null);
  t.ok("and a secret that is not its hash's length", quicKeysInto(kdf, slot, QUIC_AEAD_AES_256_GCM, secret32) === null);

  // A key update into a second slot, sharing the first's header protection.
  const next = new QuicKeysSlot();
  const nextSecret: u8[] = new Array<u8>(32);
  const derived: boolean = quicKeyUpdateSecretInto(kdf, QUIC_AEAD_AES_128_GCM, secret32, nextSecret);
  const wantSecret: u8[] | null = quicKeyUpdateSecret(QUIC_AEAD_AES_128_GCM, secret32);
  t.ok("quicKeyUpdateSecretInto is quicKeyUpdateSecret", derived && wantSecret !== null && sameBytes(nextSecret, wantSecret));
  t.ok("it refuses an output of the wrong length", !quicKeyUpdateSecretInto(kdf, QUIC_AEAD_AES_128_GCM, secret32, new Array<u8>(48)));
  t.ok("and a secret of the wrong length", !quicKeyUpdateSecretInto(kdf, QUIC_AEAD_AES_256_GCM, secret32, new Array<u8>(48)));
  const keys: QuicKeys | null = quicKeys(QUIC_AEAD_AES_128_GCM, secret32);
  if (aes128 !== null && keys !== null) {
    const updated: QuicKeys | null = quicKeysUpdateInto(kdf, next, aes128, nextSecret);
    t.ok("quicKeysUpdateInto is quicKeysUpdate", qmSameKeys(updated, quicKeysUpdate(keys, nextSecret)));
    t.ok("and shares the header-protection key and its schedule, which every generation keeps", updated !== null && qmSameAes(updated.hpAes, aes128.hpAes) && sameBytes(updated.hp, aes128.hp));
    const forged = new QuicKeys(QUIC_AEAD_AES_128_GCM, new Array<u8>(16), new Array<u8>(12), new Array<u8>(16));
    t.ok("it refuses keys quicKeys did not make", quicKeysUpdateInto(kdf, next, forged, nextSecret) === null);
    t.ok("and a next secret of the wrong length", quicKeysUpdateInto(kdf, next, aes128, new Array<u8>(48)) === null);
  }

  // `wipe` reaches every key the slot holds, of both sizes.
  quicKeysInto(kdf, slot, QUIC_AEAD_AES_256_GCM, longSecret);
  quicKeysInto(kdf, slot, QUIC_AEAD_AES_128_GCM, secret32);
  const held: boolean = !qmZero(slot.key16) && !qmZero(slot.key32) && !qmZeroAes(slot.packet128) && !qmZeroAes(slot.hp256);
  slot.wipe();
  t.ok(
    "QuicKeysSlot.wipe zeroes both key sizes, the IV and all four AES schedules",
    held &&
      qmZero(slot.key16) &&
      qmZero(slot.key32) &&
      qmZero(slot.hp16) &&
      qmZero(slot.hp32) &&
      qmZero(slot.keys.iv) &&
      qmZeroAes(slot.packet128) &&
      qmZeroAes(slot.packet256) &&
      qmZeroAes(slot.hp128) &&
      qmZeroAes(slot.hp256)
  );
};

/** Transport parameters encoded and parsed into objects and arrays that are reused. */
const parameterChecks = (t: Suite): void => {
  const p = new QuicTransportParameters();
  p.initialScid = fromHex("c0c1c2c3c4c5c6c7");
  p.hasInitialScid = true;
  p.initialMaxData = n64(65536);
  p.maxIdleTimeout = n64(30000);
  p.disableActiveMigration = true;
  const out: u8[] = fromHex("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
  quicEncodeTransportParametersInto(p, out);
  t.ok("quicEncodeTransportParametersInto replaces what the array held with quicEncodeTransportParameters' bytes", sameBytes(out, quicEncodeTransportParameters(p)));

  const into = new QuicTransportParameters();
  const parsed: QuicTransportParameters = quicParseTransportParametersInto(into, out, false);
  t.ok(
    "quicParseTransportParametersInto reads them back into the object it is given",
    parsed === into && into.error === QUIC_ERROR_NO_ERROR && into.hasInitialScid && sameBytes(into.initialScid, p.initialScid) && into.initialMaxData === n64(65536)
  );
  const scid: u8[] = into.initialScid;
  const none: u8[] = [];
  quicParseTransportParametersInto(into, none, false);
  t.ok(
    "parsed again, from nothing, every field is back at its default and the ID's array is kept, emptied",
    into.error === QUIC_ERROR_NO_ERROR &&
      !into.hasInitialScid &&
      into.initialScid === scid &&
      toI32(scid.length) === 0 &&
      into.initialMaxData === n64(0) &&
      into.maxIdleTimeout === n64(0) &&
      !into.disableActiveMigration &&
      into.maxUdpPayloadSize === n64(65527)
  );
  // original_destination_connection_id (0x00) is the server's alone (§18.2).
  quicParseTransportParametersInto(into, fromHex("0008" + "0001020304050607"), false);
  t.ok("a server-only parameter from a client is still TRANSPORT_PARAMETER_ERROR", into.error === QUIC_ERROR_TRANSPORT_PARAMETER && into.errorParameter === n64(0));
  // initial_source_connection_id (0x0f) of 21 bytes, one past what version 1 allows.
  quicParseTransportParametersInto(into, fromHex("0f15" + "000102030405060708090a0b0c0d0e0f1011121314"), false);
  t.ok(
    "a 21-byte initial_source_connection_id is TRANSPORT_PARAMETER_ERROR, and is not copied into the reused array",
    into.error === QUIC_ERROR_TRANSPORT_PARAMETER && into.errorParameter === n64(15) && toI32(into.initialScid.length) === 0
  );
};

/** Every in-place check. */
export const unitChecks = (t: Suite): void => {
  keyChecks(t);
  parameterChecks(t);
};
