// The derivations into a held `Secret`: `hkdfExpandLabelSha256Held` and its
// SHA-384 twin in `nish/crypto/hkdf`, the `*Held` steps of
// `nish/net/tls/schedule`, `TlsRecordProtection.installHeld` and
// `advanceHeld`, and `quicKeysHeldInto` and `quicKeyUpdateSecretHeldInto` in
// `nish/net/quic-packet`. Each is run on RFC 8448 §3's and RFC 9001 Appendix
// A's vectors and compared with the expected bytes and with its in-place
// (`*Into`) form on plain arrays. The plain scratch the `*Into` forms derive
// in, which a held form does not use, is read back as zero, and every
// `Secret` the test makes is wiped.
import { Suite } from "nish/testing";
import { Secret, expose, secret, wipe } from "nish:secret";
import {
  HkdfScratch,
  hkdfExpandLabelSha256,
  hkdfExpandLabelSha256Held,
  hkdfExpandLabelSha384,
  hkdfExpandLabelSha384Held,
} from "nish/crypto/hkdf";
import {
  TLS_AES_128_GCM_SHA256,
  TLS_AES_256_GCM_SHA384,
  TLS_CHACHA20_POLY1305_SHA256,
  tlsDeriveSecretHeld,
  tlsDeriveSecretInto,
  tlsEarlySecret,
  tlsFinishedVerifyDataHeld,
  tlsFinishedVerifyDataInto,
  tlsHandshakeSecretHeld,
  tlsMasterSecretHeld,
  tlsMasterSecretInto,
  tlsTrafficKeysFromHeld,
  tlsTrafficKeysInto,
} from "nish/net/tls/schedule";
import { TLS_CONTENT_APPLICATION_DATA, TlsRecordProtection } from "nish/net/tls/record";
import {
  QUIC_AEAD_AES_128_GCM,
  QUIC_AEAD_AES_256_GCM,
  QUIC_AEAD_CHACHA20_POLY1305,
  QuicKeys,
  QuicKeysSlot,
  quicKeyUpdateSecretHeldInto,
  quicKeyUpdateSecretInto,
  quicKeysHeldInto,
  quicKeysInto,
} from "nish/net/quic-packet";
import { copyOf } from "../crypto_x25519/plain";
import { fromHex, sameBytes, toHex } from "../crypto_x509/hex";
import { secretHex } from "../net_tls_common/secrets";
import {
  rfc8448ClientApplicationTraffic,
  rfc8448Ecdhe,
  rfc8448HandshakeSecret,
  rfc8448HelloHash,
  rfc8448MasterSecret,
  rfc8448ServerApplicationIv,
  rfc8448ServerApplicationKey,
  rfc8448ServerApplicationTraffic,
  rfc8448ServerHandshakeIv,
  rfc8448ServerHandshakeKey,
  rfc8448ServerHandshakeTraffic,
} from "../net_tls_rfc8448/trace";

/** Whether every byte is zero, for `expose` to run. */
const allZero = (bytes: u8[]): boolean => {
  for (const b of bytes) {
    if (b !== toU8(0)) {
      return false;
    }
  }
  return true;
};

/** A fresh `Secret` of `length` zero bytes: a destination for a held form. */
const heldOf = (length: i32): Secret<u8[]> => secret(new Array<u8>(length));

/** `length` bytes counting up from `seed` by `step`: a key no RFC prints, for the SHA-384 paths. */
const ramp = (length: i32, seed: i32, step: i32): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < length; k++) {
    out.push(toU8((seed + k * step) & 255));
  }
  return out;
};

/** `bytes` at offset `at` of a buffer `at + bytes.length + 2` long: a window read in place. */
const placed = (bytes: u8[], at: i32): u8[] => {
  const out: u8[] = new Array<u8>(at + toI32(bytes.length) + 2);
  for (let k: i32 = 0; k < toI32(bytes.length); k++) {
    out[at + k] = bytes[k];
  }
  return out;
};

/** Whether two key sets carry the same suite, key, IV and header-protection key. */
const sameKeys = (got: QuicKeys | null, want: QuicKeys | null): boolean =>
  got !== null && want !== null && got.aead === want.aead && sameBytes(got.key, want.key) && sameBytes(got.iv, want.iv) && sameBytes(got.hp, want.hp);

/** The record a protection seals for a fixed message: the AES schedule (or ChaCha20 key) at work. */
const sealed = (p: TlsRecordProtection): string => {
  const data: u8[] = fromHex("68656c6c6f2c2068656c64");
  const out: u8[] = new Array<u8>(64);
  const n: i32 = p.seal(TLS_CONTENT_APPLICATION_DATA, data, 0, toI32(data.length), 0, out, 0);
  const record: u8[] = new Array<u8>(n);
  for (let k: i32 = 0; k < n; k++) {
    record[k] = out[k];
  }
  return toHex(record);
};

/** HKDF-Expand-Label into a held `Secret`, against the one-shot plain forms. */
const hkdfChecks = (t: Suite): void => {
  const none: u8[] = [];
  const l32: i32 = 32;
  const l48: i32 = 48;
  // RFC 9001 A.1: client_initial_secret from initial_secret.
  const initialHex: string = "7db5df06e7a69e432496adedb00851923595221596ae2ae9fb8115c1e9ed0a44";
  const initial: Secret<u8[]> = secret(fromHex(initialHex));
  const client: Secret<u8[]> = heldOf(32);
  hkdfExpandLabelSha256Held(client, initial, "client in", none);
  t.eqStr(
    "hkdfExpandLabelSha256Held: RFC 9001 A.1 client_initial_secret",
    secretHex(client),
    "c00cf151ca5be075ed0ebfb5c80323c42d6b7db67881289af4008f1f6c357aea"
  );
  t.eqStr("and it is what hkdfExpandLabelSha256 answers", secretHex(client), toHex(hkdfExpandLabelSha256(fromHex(initialHex), "client in", none, l32)));
  t.eqStr("the source is left as it was", secretHex(initial), initialHex);
  // The destination may be the source: a ratchet in place.
  hkdfExpandLabelSha256Held(initial, initial, "server in", none);
  t.eqStr(
    "into its own source: RFC 9001 A.1 server_initial_secret",
    secretHex(initial),
    "3c199828fd139efd216c155ad844cc81fb82fa8d7446fa7d78be803acdda951b"
  );
  // The output length is the destination's: a 16-byte key from the client secret.
  const key: Secret<u8[]> = heldOf(16);
  hkdfExpandLabelSha256Held(key, client, "quic key", none);
  t.eqStr("a 16-byte destination: RFC 9001 A.1 client key", secretHex(key), "1f369613dd76d5467730efcbe3b1a22d");
  wipe(initial);
  wipe(client);
  wipe(key);

  // SHA-384, on a key no RFC prints, against the plain form.
  const prk: u8[] = ramp(48, 7, 13);
  const context: u8[] = ramp(48, 1, 3);
  const held: Secret<u8[]> = secret(copyOf(prk));
  const okm: Secret<u8[]> = heldOf(48);
  hkdfExpandLabelSha384Held(okm, held, "c ap traffic", context);
  t.eqStr("hkdfExpandLabelSha384Held is hkdfExpandLabelSha384", secretHex(okm), toHex(hkdfExpandLabelSha384(prk, "c ap traffic", context, l48)));
  hkdfExpandLabelSha384Held(held, held, "traffic upd", none);
  t.eqStr("and into its own source", secretHex(held), toHex(hkdfExpandLabelSha384(prk, "traffic upd", none, l48)));
  wipe(okm);
  wipe(held);
};

/** The TLS 1.3 schedule into held `Secret`s along RFC 8448 §3, against the `*Into` forms. */
const scheduleChecks = (t: Suite): void => {
  const kdf = new HkdfScratch();
  const h: i32 = 32;
  const zero: i32 = 0;

  const early: Secret<u8[]> = tlsEarlySecret(h);
  const ecdhe: Secret<u8[]> = secret(rfc8448Ecdhe());
  const handshake: Secret<u8[]> = heldOf(32);
  tlsHandshakeSecretHeld(h, early, ecdhe, handshake);
  t.eqStr('tlsHandshakeSecretHeld: RFC 8448 extract secret "handshake"', secretHex(handshake), toHex(rfc8448HandshakeSecret()));
  // Into the early secret itself, as a caller that ratchets one Secret would.
  tlsHandshakeSecretHeld(h, early, ecdhe, early);
  t.eqStr("and into its own early secret", secretHex(early), toHex(rfc8448HandshakeSecret()));
  wipe(early);
  wipe(ecdhe);

  // Derive-Secret over a transcript hash read in place, at offset 3.
  const transcript: u8[] = placed(rfc8448HelloHash(), 3);
  const traffic: Secret<u8[]> = heldOf(32);
  tlsDeriveSecretHeld(h, handshake, "s hs traffic", transcript, 3, traffic);
  t.eqStr('tlsDeriveSecretHeld: RFC 8448 "tls13 s hs traffic"', secretHex(traffic), toHex(rfc8448ServerHandshakeTraffic()));
  const trafficInto: u8[] = new Array<u8>(32);
  tlsDeriveSecretInto(kdf, h, rfc8448HandshakeSecret(), "s hs traffic", transcript, 3, trafficInto);
  t.eqStr("and it is what tlsDeriveSecretInto writes", secretHex(traffic), toHex(trafficInto));

  const master: Secret<u8[]> = heldOf(32);
  tlsMasterSecretHeld(h, handshake, master);
  t.eqStr('tlsMasterSecretHeld: RFC 8448 extract secret "master"', secretHex(master), toHex(rfc8448MasterSecret()));
  const masterInto: u8[] = new Array<u8>(32);
  tlsMasterSecretInto(kdf, h, rfc8448HandshakeSecret(), masterInto);
  t.eqStr("and it is what tlsMasterSecretInto writes", secretHex(master), toHex(masterInto));
  tlsMasterSecretHeld(h, handshake, handshake);
  t.eqStr("and into its own handshake secret", secretHex(handshake), toHex(rfc8448MasterSecret()));

  const verifyData: u8[] = tlsFinishedVerifyDataHeld(h, traffic, transcript, 3);
  const verifyInto: u8[] = new Array<u8>(32);
  tlsFinishedVerifyDataInto(kdf, h, rfc8448ServerHandshakeTraffic(), transcript, 3, verifyInto, zero);
  t.eqStr("tlsFinishedVerifyDataHeld is tlsFinishedVerifyDataInto", toHex(verifyData), toHex(verifyInto));

  const key: u8[] = new Array<u8>(16);
  const iv: u8[] = new Array<u8>(12);
  t.ok("tlsTrafficKeysFromHeld derives for AES-128-GCM", tlsTrafficKeysFromHeld(TLS_AES_128_GCM_SHA256, traffic, key, iv));
  t.eqStr("RFC 8448 server handshake key", toHex(key), toHex(rfc8448ServerHandshakeKey()));
  t.eqStr("RFC 8448 server handshake iv", toHex(iv), toHex(rfc8448ServerHandshakeIv()));
  const keyInto: u8[] = new Array<u8>(16);
  const ivInto: u8[] = new Array<u8>(12);
  tlsTrafficKeysInto(kdf, TLS_AES_128_GCM_SHA256, rfc8448ServerHandshakeTraffic(), keyInto, ivInto);
  t.ok("and they are what tlsTrafficKeysInto writes", sameBytes(key, keyInto) && sameBytes(iv, ivInto));
  const untouched: u8[] = new Array<u8>(32);
  t.ok(
    "it refuses a key of the wrong length, writing nothing",
    !tlsTrafficKeysFromHeld(TLS_AES_128_GCM_SHA256, traffic, untouched, iv) && allZero(untouched)
  );
  t.ok("and a secret that is not its hash's length", !tlsTrafficKeysFromHeld(TLS_AES_256_GCM_SHA384, traffic, untouched, iv));
  wipe(handshake);
  wipe(traffic);
  wipe(master);

  // SHA-384, on a key no RFC prints.
  const h48: i32 = 48;
  const prk: u8[] = ramp(48, 3, 29);
  const hash: u8[] = placed(ramp(48, 5, 11), 1);
  const held: Secret<u8[]> = secret(copyOf(prk));
  const out: Secret<u8[]> = heldOf(48);
  tlsDeriveSecretHeld(h48, held, "c ap traffic", hash, 1, out);
  const outInto: u8[] = new Array<u8>(48);
  tlsDeriveSecretInto(kdf, h48, prk, "c ap traffic", hash, 1, outInto);
  t.eqStr("tlsDeriveSecretHeld under SHA-384 is tlsDeriveSecretInto", secretHex(out), toHex(outInto));
  tlsMasterSecretHeld(h48, held, out);
  tlsMasterSecretInto(kdf, h48, prk, outInto);
  t.eqStr("tlsMasterSecretHeld under SHA-384 is tlsMasterSecretInto", secretHex(out), toHex(outInto));
  const verify48: u8[] = new Array<u8>(48);
  tlsFinishedVerifyDataInto(kdf, h48, prk, hash, 1, verify48, zero);
  t.eqStr("tlsFinishedVerifyDataHeld under SHA-384 is tlsFinishedVerifyDataInto", toHex(tlsFinishedVerifyDataHeld(h48, held, hash, 1)), toHex(verify48));
  const key32: u8[] = new Array<u8>(32);
  const key32Into: u8[] = new Array<u8>(32);
  const ivInto48: u8[] = new Array<u8>(12);
  tlsTrafficKeysFromHeld(TLS_AES_256_GCM_SHA384, held, key32, iv);
  tlsTrafficKeysInto(kdf, TLS_AES_256_GCM_SHA384, prk, key32Into, ivInto48);
  t.ok("tlsTrafficKeysFromHeld under AES-256-GCM-SHA384 is tlsTrafficKeysInto", sameBytes(key32, key32Into) && sameBytes(iv, ivInto48));
  wipe(held);
  wipe(out);
};

/** `installHeld` and `advanceHeld` against `install` and `advance` on the same secret. */
const recordChecks = (t: Suite): void => {
  const held = new TlsRecordProtection();
  const plain = new TlsRecordProtection();
  const traffic: Secret<u8[]> = secret(rfc8448ServerApplicationTraffic());
  t.ok("installHeld installs AES-128-GCM", held.installHeld(TLS_AES_128_GCM_SHA256, traffic));
  plain.install(TLS_AES_128_GCM_SHA256, rfc8448ServerApplicationTraffic());
  t.eqStr("RFC 8448 server application key", toHex(held.key), toHex(rfc8448ServerApplicationKey()));
  t.eqStr("RFC 8448 server application iv", toHex(held.iv), toHex(rfc8448ServerApplicationIv()));
  t.eqStr("and its record is install's, byte for byte", sealed(held), sealed(plain));

  const next: u8[] = rfc8448ServerApplicationTraffic();
  t.ok("advanceHeld moves to the next key", held.advanceHeld(traffic));
  plain.advance(next);
  t.eqStr("the held secret is ratcheted in place to advance's next secret", secretHex(traffic), toHex(next));
  t.ok("the keys are advance's", sameBytes(held.key, plain.key) && sameBytes(held.iv, plain.iv));
  t.eqStr("and so is the record", sealed(held), sealed(plain));
  t.ok(
    "the held forms leave no plain copy in the direction's own scratch: its next secret and HKDF state read zero",
    allZero(held.next) && allZero(held.kdf.previous)
  );

  const short: Secret<u8[]> = heldOf(16);
  t.ok("installHeld refuses a secret that is not its hash's length", !held.installHeld(TLS_AES_128_GCM_SHA256, short));
  t.ok("leaving the direction cleartext", !held.isProtected() && allZero(held.key) && allZero(held.iv));
  t.ok("advanceHeld refuses on a cleartext direction", !held.advanceHeld(traffic));

  // ChaCha20-Poly1305, no schedule, then AES-256-GCM-SHA384 on a 48-byte secret.
  const client: Secret<u8[]> = secret(rfc8448ClientApplicationTraffic());
  held.installHeld(TLS_CHACHA20_POLY1305_SHA256, client);
  plain.install(TLS_CHACHA20_POLY1305_SHA256, rfc8448ClientApplicationTraffic());
  t.eqStr("installHeld under ChaCha20-Poly1305 seals what install seals", sealed(held), sealed(plain));
  const long: u8[] = ramp(48, 9, 17);
  const traffic48: Secret<u8[]> = secret(copyOf(long));
  held.installHeld(TLS_AES_256_GCM_SHA384, traffic48);
  plain.install(TLS_AES_256_GCM_SHA384, long);
  t.eqStr("and under AES-256-GCM-SHA384", sealed(held), sealed(plain));
  held.advanceHeld(traffic48);
  plain.advance(long);
  t.eqStr("advanceHeld under SHA-384 ratchets as advance does", secretHex(traffic48), toHex(long));
  t.eqStr("and seals as it does", sealed(held), sealed(plain));
  wipe(traffic);
  wipe(short);
  wipe(client);
  wipe(traffic48);
};

/** `quicKeysHeldInto` and `quicKeyUpdateSecretHeldInto` on RFC 9001 Appendix A, against the `*Into` forms. */
const quicChecks = (t: Suite): void => {
  const kdf = new HkdfScratch();
  const slot = new QuicKeysSlot();
  const into = new QuicKeysSlot();
  const clientHex: string = "c00cf151ca5be075ed0ebfb5c80323c42d6b7db67881289af4008f1f6c357aea";
  const client: Secret<u8[]> = secret(fromHex(clientHex));
  const aes: QuicKeys | null = quicKeysHeldInto(slot, QUIC_AEAD_AES_128_GCM, client);
  t.ok(
    "quicKeysHeldInto: RFC 9001 A.1 client key, iv and hp",
    aes !== null &&
      toHex(aes.key) === "1f369613dd76d5467730efcbe3b1a22d" &&
      toHex(aes.iv) === "fa044b2f42a3fd3b46fb255c" &&
      toHex(aes.hp) === "9f50449e04a0e810283a1e9933adedd2"
  );
  t.ok("and they are quicKeysInto's", sameKeys(aes, quicKeysInto(kdf, into, QUIC_AEAD_AES_128_GCM, fromHex(clientHex))));

  // RFC 9001 A.5, ChaCha20-Poly1305, and its key update.
  const chachaHex: string = "9ac312a7f877468ebe69422748ad00a15443f18203a07d6060f688f30f21632b";
  const chachaSecret: Secret<u8[]> = secret(fromHex(chachaHex));
  const chacha: QuicKeys | null = quicKeysHeldInto(slot, QUIC_AEAD_CHACHA20_POLY1305, chachaSecret);
  t.ok(
    "quicKeysHeldInto: RFC 9001 A.5 key, iv and hp",
    chacha !== null &&
      toHex(chacha.key) === "c6d98ff3441c3fe1b2182094f69caa2ed4b716b65488960a7a984979fb23e1c8" &&
      toHex(chacha.iv) === "e0459b3474bdd0e44a41c144" &&
      toHex(chacha.hp) === "25a282b9e82f06f21f488917a4fc8f1b73573685608597d0efcb076b0ab7a7a4"
  );
  t.ok("and they are quicKeysInto's", sameKeys(chacha, quicKeysInto(kdf, into, QUIC_AEAD_CHACHA20_POLY1305, fromHex(chachaHex))));
  const updated: Secret<u8[]> = heldOf(32);
  t.ok("quicKeyUpdateSecretHeldInto derives", quicKeyUpdateSecretHeldInto(updated, chachaSecret));
  t.eqStr(
    "RFC 9001 A.5 ku",
    secretHex(updated),
    "1223504755036d556342ee9361d253421a826c9ecdf3c7148684b36b714881f9"
  );
  const updatedInto: u8[] = new Array<u8>(32);
  quicKeyUpdateSecretInto(kdf, QUIC_AEAD_CHACHA20_POLY1305, fromHex(chachaHex), updatedInto);
  t.eqStr("and it is quicKeyUpdateSecretInto's", secretHex(updated), toHex(updatedInto));
  t.ok("into its own source, a ratchet in place", quicKeyUpdateSecretHeldInto(chachaSecret, chachaSecret));
  t.eqStr("gives the same next secret", secretHex(chachaSecret), secretHex(updated));

  // AES-256-GCM on a 48-byte secret no RFC prints.
  const long: u8[] = ramp(48, 11, 7);
  const held48: Secret<u8[]> = secret(copyOf(long));
  t.ok(
    "quicKeysHeldInto under AES-256-GCM is quicKeysInto",
    sameKeys(quicKeysHeldInto(slot, QUIC_AEAD_AES_256_GCM, held48), quicKeysInto(kdf, into, QUIC_AEAD_AES_256_GCM, long))
  );
  const next48: Secret<u8[]> = heldOf(48);
  const next48Into: u8[] = new Array<u8>(48);
  quicKeyUpdateSecretHeldInto(next48, held48);
  quicKeyUpdateSecretInto(kdf, QUIC_AEAD_AES_256_GCM, long, next48Into);
  t.eqStr("quicKeyUpdateSecretHeldInto under SHA-384 is quicKeyUpdateSecretInto", secretHex(next48), toHex(next48Into));

  t.ok("quicKeysHeldInto refuses a secret that is not its hash's length", quicKeysHeldInto(slot, QUIC_AEAD_AES_256_GCM, client) === null);
  t.ok("quicKeyUpdateSecretHeldInto refuses lengths that differ", !quicKeyUpdateSecretHeldInto(next48, client));
  const odd: Secret<u8[]> = heldOf(20);
  t.ok("and a length that is no hash's", !quicKeyUpdateSecretHeldInto(odd, odd) && expose(odd, allZero));
  wipe(client);
  wipe(chachaSecret);
  wipe(updated);
  wipe(held48);
  wipe(next48);
  wipe(odd);
};

export const main = (): i32 => {
  const t = new Suite("crypto held derive");
  hkdfChecks(t);
  scheduleChecks(t);
  recordChecks(t);
  quicChecks(t);
  return t.done();
};
