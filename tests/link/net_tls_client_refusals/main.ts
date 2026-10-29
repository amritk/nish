// The server flights `nish/net/tls/client` refuses, each with its alert: a
// ServerHello built byte by byte (so it can be broken), or a real server's
// flight with one thing changed. Every case starts a fresh client.
import { Suite } from "nish/testing";
import { TLS_LEVEL_APPLICATION, TLS_LEVEL_HANDSHAKE, TLS_LEVEL_INITIAL, TlsServer } from "nish/net/tls";
import {
  TLS_ALERT_BAD_CERTIFICATE,
  TLS_ALERT_DECODE_ERROR,
  TLS_ALERT_DECRYPT_ERROR,
  TLS_ALERT_ILLEGAL_PARAMETER,
  TLS_ALERT_INTERNAL_ERROR,
  TLS_ALERT_MISSING_EXTENSION,
  TLS_ALERT_PROTOCOL_VERSION,
  TLS_ALERT_UNEXPECTED_MESSAGE,
  TLS_ALERT_UNSUPPORTED_EXTENSION,
  TLS_GROUP_SECP256R1,
  TLS_GROUP_X25519,
  TLS_SIGNATURE_ECDSA_SECP256R1_SHA256,
} from "nish/net/tls/codec";
import {
  TLS_CLIENT_STATE_CONNECTED,
  TLS_CLIENT_STATE_FAILED,
  TLS_CLIENT_STATE_START,
  TLS_CLIENT_STATE_WAIT_AUTH,
  TLS_CLIENT_STATE_WAIT_CERTIFICATE,
  TLS_CLIENT_STATE_WAIT_CERTIFICATE_VERIFY,
  TLS_CLIENT_STATE_WAIT_ENCRYPTED_EXTENSIONS,
  TLS_CLIENT_STATE_WAIT_SERVER_HELLO,
  TlsClient,
  TlsClientConfig,
  tlsClientIsIpLiteral,
} from "nish/net/tls/client";
import { tlsEarlySecret, tlsHandshakeSecretHeld } from "nish/net/tls/schedule";
import { Secret, secret, wipe } from "nish:secret";
import { p256Ecdh, p256VerifySha256 } from "nish/crypto/p256";
import { x509DerSignatureRS } from "nish/crypto/x509";
import { p256PublicKeyPlain } from "../crypto_p256/plain";
import { secretHex } from "../net_tls_common/secrets";
import { x25519BasePlain } from "../crypto_x25519/plain";
import { bytesOf, fromHex, sameBytes, toHex } from "../crypto_x509/hex";
import { leafCertificate, leafPrivate, leafPublic, newServer, serverPrivate, signWithLeaf, tcpConfig } from "../net_tls_common/server";

const ZERO: i32 = 0;
const SUPPORTED_VERSIONS: i32 = 0x002b;
const KEY_SHARE: i32 = 0x0033;
const ALPN: i32 = 0x0010;
const SERVER_NAME: i32 = 0x0000;
const COOKIE: i32 = 0x002c;
const AES_128: i32 = 0x1301;
const AES_256: i32 = 0x1302;
const CCM: i32 = 0x1304;
const SESSION_ID_AT: i32 = 4 + 2 + 32 + 1;
const CERTIFICATE_EXPIRED: i32 = 45;

const counting = (start: i32, count: i32): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < count; k++) {
    out.push(toU8(start + k));
  }
  return out;
};

const u16 = (out: u8[], value: i32): void => {
  out.push(toU8((value >> 8) & 0xff));
  out.push(toU8(value & 0xff));
};

const append = (out: u8[], data: u8[]): void => {
  for (let k: i32 = 0; k < toI32(data.length); k++) {
    out.push(data[k]);
  }
};

/** One extension: its type, its length and `data`. */
const ext = (type: i32, data: u8[]): u8[] => {
  const out: u8[] = [];
  u16(out, type);
  u16(out, toI32(data.length));
  append(out, data);
  return out;
};

/** A handshake message: its type, a 24-bit length and `body`. */
const message = (type: i32, body: u8[]): u8[] => {
  const n: i32 = toI32(body.length);
  const out: u8[] = [toU8(type), toU8((n >> 16) & 0xff), toU8((n >> 8) & 0xff), toU8(n & 0xff)];
  append(out, body);
  return out;
};

const versions = (): u8[] => ext(SUPPORTED_VERSIONS, [0x03, 0x04]);

const share = (group: i32, key: u8[]): u8[] => {
  const data: u8[] = [];
  u16(data, group);
  u16(data, toI32(key.length));
  append(data, key);
  return ext(KEY_SHARE, data);
};

const retryShare = (group: i32): u8[] => {
  const data: u8[] = [];
  u16(data, group);
  return ext(KEY_SHARE, data);
};

const serverPublic = (): u8[] => {
  const pub: u8[] | null = x25519BasePlain(serverPrivate());
  if (pub === null) {
    return [];
  }
  return pub;
};

const retryRandom = (): u8[] => fromHex("cf21ad74e59a6111be1d8c021e65b891c2a211167abb8c5e079e09e2c8a8339c");

/** A ServerHello: `random`, the client's session id, `suite`, null compression and `exts` as they are, their length said as `extsLength`. */
const helloWith = (random: u8[], client: TlsClient, suite: i32, exts: u8[], extsLength: i32): u8[] => {
  const body: u8[] = [0x03, 0x03];
  append(body, random);
  body.push(toU8(toI32(client.sessionId.length)));
  append(body, client.sessionId);
  u16(body, suite);
  body.push(toU8(0));
  u16(body, extsLength);
  append(body, exts);
  return message(2, body);
};

const hello = (random: u8[], client: TlsClient, suite: i32, exts: u8[]): u8[] =>
  helloWith(random, client, suite, exts, toI32(exts.length));

const join = (parts: u8[][]): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < toI32(parts.length); k++) {
    append(out, parts[k]);
  }
  return out;
};

/** The extensions of a good ServerHello: an x25519 share, then TLS 1.3. */
const goodExts = (): u8[] => join([share(TLS_GROUP_X25519, serverPublic()), versions()]);

const started = (config: TlsClientConfig): TlsClient => {
  const client = new TlsClient(config, counting(1, 32), counting(0x40, 32), counting(0x60, 32));
  client.start();
  client.takeOutput(TLS_LEVEL_INITIAL);
  return client;
};

const fresh = (): TlsClient => started(new TlsClientConfig("localhost", ["h2"]));

/** A client offering x25519 and secp256r1, its share of `shareGroup`. */
const twoGroups = (shareGroup: i32): TlsClient => {
  const config = new TlsClientConfig("localhost", ["h2"]);
  config.groups = [TLS_GROUP_X25519, TLS_GROUP_SECP256R1];
  config.shareGroup = shareGroup;
  return started(config);
};

const feed = (client: TlsClient, level: i32, data: u8[]): i32 => client.receive(level, data, ZERO, toI32(data.length));

const refused = (t: Suite, name: string, client: TlsClient, got: i32, alert: i32): void => {
  t.eqI32(name, got, alert);
  t.eqI32(name + ": failed", client.state, TLS_CLIENT_STATE_FAILED);
  t.eqI32(name + ": keeps its alert", feed(client, TLS_LEVEL_INITIAL, [0x02]), alert);
};

const randomOf = (start: i32): u8[] => counting(start, 32);

/** A random ending in RFC 8446 §4.1.3's TLS 1.2 downgrade sentinel. */
const downgradeRandom = (): u8[] => {
  const out: u8[] = counting(0xa0, 24);
  append(out, fromHex("444f574e47524401"));
  return out;
};

/** A client past a good ServerHello, waiting on EncryptedExtensions. */
const afterHello = (): TlsClient => {
  const client = fresh();
  feed(client, TLS_LEVEL_INITIAL, hello(randomOf(0xa0), client, AES_128, goodExts()));
  return client;
};

/** EncryptedExtensions carrying `exts`. */
const encryptedExtensions = (exts: u8[]): u8[] => {
  const body: u8[] = [];
  u16(body, toI32(exts.length));
  append(body, exts);
  return message(8, body);
};

const alpnOf = (name: string): u8[] => {
  const data: u8[] = [];
  u16(data, toI32(name.length) + 1);
  data.push(toU8(toI32(name.length)));
  for (let k: i32 = 0; k < toI32(name.length); k++) {
    data.push(toU8(name.charCodeAt(k)));
  }
  return ext(ALPN, data);
};

/** A real server's ServerHello and flight for a fresh client, the flight with `edit` applied. */
class Real {
  client: TlsClient;
  server: TlsServer;
  serverHello: u8[];
  flight: u8[];

  constructor() {
    this.client = new TlsClient(new TlsClientConfig("localhost", ["h2"]), counting(1, 32), counting(0x40, 32), counting(0x60, 32));
    this.server = newServer(tcpConfig(["h2"]));
    this.client.start();
    const ch: u8[] = this.client.takeOutput(TLS_LEVEL_INITIAL);
    this.server.receive(TLS_LEVEL_INITIAL, ch, ZERO, toI32(ch.length));
    this.serverHello = this.server.takeOutput(TLS_LEVEL_INITIAL);
    signWithLeaf(this.server);
    this.flight = this.server.takeOutput(TLS_LEVEL_HANDSHAKE);
  }
}

/** Where the handshake message at `at` of `data` ends. */
const messageEnd = (data: u8[], at: i32): i32 =>
  at + 4 + ((toI32(data[at + 1]) << 16) | (toI32(data[at + 2]) << 8) | toI32(data[at + 3]));

/** `data[from .. to)`, copied. */
const part = (data: u8[], from: i32, to: i32): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = from; k < to; k++) {
    out.push(data[k]);
  }
  return out;
};

/** A real server's client fed its ServerHello and the first `count` messages of its flight. */
const realUpTo = (count: i32): Real => {
  const real = new Real();
  feed(real.client, TLS_LEVEL_INITIAL, real.serverHello);
  let end: i32 = 0;
  for (let k: i32 = 0; k < count; k++) {
    end = messageEnd(real.flight, end);
  }
  real.client.receive(TLS_LEVEL_HANDSHAKE, real.flight, ZERO, end);
  return real;
};

/** The body of message `index` of a real server's flight. */
const realBody = (real: Real, index: i32): u8[] => {
  let at: i32 = 0;
  for (let k: i32 = 0; k < index; k++) {
    at = messageEnd(real.flight, at);
  }
  return part(real.flight, at + 4, messageEnd(real.flight, at));
};

/** The P-256 public key of the private key `started` gives every client. */
const clientP256Public = (): u8[] => {
  const pub: u8[] | null = p256PublicKeyPlain(counting(0x60, 32));
  if (pub === null) {
    return [];
  }
  return pub;
};

/**
 * The handshake secret (RFC 8446 §7.1) a server computes over SHA-256 with the
 * leaf's P-256 key and the client's share: what a client that took the leaf's
 * public key as the server's share must derive.
 */
const p256HandshakeHex = (): string => {
  const key: Secret<u8[]> = secret(leafPrivate());
  const shared: Secret<u8[]> | null = p256Ecdh(key, clientP256Public());
  wipe(key);
  if (shared === null) {
    return "no shared secret";
  }
  const early: Secret<u8[]> = tlsEarlySecret(32);
  const handshake: Secret<u8[]> = secret(new Array<u8>(32));
  tlsHandshakeSecretHeld(32, early, shared, handshake);
  const hex: string = secretHex(handshake);
  wipe(early);
  wipe(shared);
  wipe(handshake);
  return hex;
};

/** The extensions of the ClientHello `ch` begin here: after its header, version, random, session id, suites and compression. */
const helloExtensionsAt = (ch: u8[]): i32 => {
  let at: i32 = 4 + 2 + 32;
  at += 1 + toI32(ch[at]);
  at += 2 + ((toI32(ch[at]) << 8) | toI32(ch[at + 1]));
  at += 1 + toI32(ch[at]);
  return at + 2;
};

/** The cipher suites of the ClientHello `ch`, as sent. */
const helloSuites = (ch: u8[]): u8[] => {
  let at: i32 = 4 + 2 + 32;
  at += 1 + toI32(ch[at]);
  return part(ch, at + 2, at + 2 + ((toI32(ch[at]) << 8) | toI32(ch[at + 1])));
};

/** The compression methods of the ClientHello `ch`, their count first. */
const helloCompression = (ch: u8[]): u8[] => {
  const at: i32 = helloExtensionsAt(ch) - 2;
  let from: i32 = 4 + 2 + 32;
  from += 1 + toI32(ch[from]);
  from += 2 + ((toI32(ch[from]) << 8) | toI32(ch[from + 1]));
  return part(ch, from, at);
};

/** The extension types of the ClientHello `ch`, two bytes each, in order. */
const helloTypes = (ch: u8[]): u8[] => {
  const out: u8[] = [];
  let at: i32 = helloExtensionsAt(ch);
  while (at + 4 <= toI32(ch.length)) {
    out.push(ch[at]);
    out.push(ch[at + 1]);
    at += 4 + ((toI32(ch[at + 2]) << 8) | toI32(ch[at + 3]));
  }
  return out;
};

/** The data of the ClientHello extension `type`, or null when `ch` has none. */
const helloExt = (ch: u8[], type: i32): u8[] | null => {
  let at: i32 = helloExtensionsAt(ch);
  while (at + 4 <= toI32(ch.length)) {
    const length: i32 = (toI32(ch[at + 2]) << 8) | toI32(ch[at + 3]);
    if (((toI32(ch[at]) << 8) | toI32(ch[at + 1])) === type) {
      return part(ch, at + 4, at + 4 + length);
    }
    at += 4 + length;
  }
  return null;
};

const helloExtHex = (ch: u8[], type: i32): string => {
  const data: u8[] | null = helloExt(ch, type);
  if (data === null) {
    return "absent";
  }
  return toHex(data);
};

/** The first ClientHello a client with `config` sends. */
const firstHello = (config: TlsClientConfig): u8[] => {
  const client = new TlsClient(config, counting(1, 32), counting(0x40, 32), counting(0x60, 32));
  client.start();
  return client.takeOutput(TLS_LEVEL_INITIAL);
};

/** The x25519 public key of the private key `started` gives every client. */
const clientX25519Public = (): u8[] => {
  const pub: u8[] | null = x25519BasePlain(counting(0x40, 32));
  if (pub === null) {
    return [];
  }
  return pub;
};

/** Whether `needle` appears in `hay`. */
const holds = (hay: u8[], needle: u8[]): boolean => {
  const n: i32 = toI32(needle.length);
  for (let at: i32 = 0; at + n <= toI32(hay.length); at++) {
    let k: i32 = 0;
    while (k < n && hay[at + k] === needle[k]) {
      k++;
    }
    if (k === n) {
      return true;
    }
  }
  return false;
};

export const main = (): i32 => {
  const t = new Suite("tls client refusals");

  // The structure.
  let c: TlsClient = fresh();
  const good: u8[] = goodExts();
  refused(t, "truncated extensions", c, feed(c, TLS_LEVEL_INITIAL, helloWith(randomOf(0xa0), c, AES_128, good, toI32(good.length) + 4)), TLS_ALERT_DECODE_ERROR);
  c = fresh();
  refused(t, "oversized message", c, feed(c, TLS_LEVEL_INITIAL, [0x02, 0xff, 0xff, 0xff]), TLS_ALERT_DECODE_ERROR);
  c = fresh();
  refused(t, "duplicate extension", c, feed(c, TLS_LEVEL_INITIAL, hello(randomOf(0xa0), c, AES_128, join([good, versions()]))), TLS_ALERT_ILLEGAL_PARAMETER);
  c = fresh();
  const trailing: u8[] = hello(randomOf(0xa0), c, AES_128, good);
  trailing.push(toU8(0x08));
  refused(t, "bytes after the ServerHello", c, feed(c, TLS_LEVEL_INITIAL, trailing), TLS_ALERT_UNEXPECTED_MESSAGE);

  // The version.
  c = fresh();
  refused(t, "missing supported_versions", c, feed(c, TLS_LEVEL_INITIAL, hello(randomOf(0xa0), c, AES_128, share(TLS_GROUP_X25519, serverPublic()))), TLS_ALERT_PROTOCOL_VERSION);
  c = fresh();
  refused(t, "downgrade sentinel", c, feed(c, TLS_LEVEL_INITIAL, hello(downgradeRandom(), c, AES_128, share(TLS_GROUP_X25519, serverPublic()))), TLS_ALERT_ILLEGAL_PARAMETER);

  c = fresh();
  const tls11: u8[] = downgradeRandom();
  tls11[31] = 0x00;
  refused(t, "TLS 1.1 downgrade sentinel", c, feed(c, TLS_LEVEL_INITIAL, hello(tls11, c, AES_128, share(TLS_GROUP_X25519, serverPublic()))), TLS_ALERT_ILLEGAL_PARAMETER);
  c = fresh();
  const legacy: u8[] = hello(randomOf(0xa0), c, AES_128, good);
  legacy[5] = 0x04;
  refused(t, "legacy_version other than 0x0303", c, feed(c, TLS_LEVEL_INITIAL, legacy), TLS_ALERT_ILLEGAL_PARAMETER);
  c = fresh();
  refused(t, "supported_versions selecting TLS 1.2", c, feed(c, TLS_LEVEL_INITIAL, hello(randomOf(0xa0), c, AES_128, join([share(TLS_GROUP_X25519, serverPublic()), ext(SUPPORTED_VERSIONS, [0x03, 0x03])]))), TLS_ALERT_ILLEGAL_PARAMETER);
  c = fresh();
  const compression: u8[] = hello(randomOf(0xa0), c, AES_128, good);
  compression[SESSION_ID_AT + toI32(c.sessionId.length) + 2] = 0x01;
  refused(t, "non-null compression", c, feed(c, TLS_LEVEL_INITIAL, compression), TLS_ALERT_ILLEGAL_PARAMETER);
  c = fresh();
  refused(t, "an unsolicited extension in the ServerHello", c, feed(c, TLS_LEVEL_INITIAL, hello(randomOf(0xa0), c, AES_128, join([good, ext(0x1234, [])]))), TLS_ALERT_UNSUPPORTED_EXTENSION);
  c = fresh();
  refused(t, "ALPN in the ServerHello", c, feed(c, TLS_LEVEL_INITIAL, hello(randomOf(0xa0), c, AES_128, join([good, alpnOf("h2")]))), TLS_ALERT_ILLEGAL_PARAMETER);

  // What the server picks.
  c = fresh();
  refused(t, "unoffered suite", c, feed(c, TLS_LEVEL_INITIAL, hello(randomOf(0xa0), c, CCM, good)), TLS_ALERT_ILLEGAL_PARAMETER);
  c = fresh();
  refused(t, "unoffered group in the share", c, feed(c, TLS_LEVEL_INITIAL, hello(randomOf(0xa0), c, AES_128, join([share(TLS_GROUP_SECP256R1, leafPublic()), versions()]))), TLS_ALERT_ILLEGAL_PARAMETER);
  c = fresh();
  refused(t, "unoffered group in a retry", c, feed(c, TLS_LEVEL_INITIAL, hello(retryRandom(), c, AES_128, join([retryShare(TLS_GROUP_SECP256R1), versions()]))), TLS_ALERT_ILLEGAL_PARAMETER);
  c = twoGroups(TLS_GROUP_X25519);
  refused(t, "a retry for the group already shared", c, feed(c, TLS_LEVEL_INITIAL, hello(retryRandom(), c, AES_128, join([retryShare(TLS_GROUP_X25519), versions()]))), TLS_ALERT_ILLEGAL_PARAMETER);
  c = fresh();
  refused(t, "no key_share", c, feed(c, TLS_LEVEL_INITIAL, hello(randomOf(0xa0), c, AES_128, versions())), TLS_ALERT_MISSING_EXTENSION);
  c = fresh();
  const sid: u8[] = c.sessionId;
  sid[0] = toU8(toI32(sid[0]) ^ 1);
  const wrongEcho: u8[] = hello(randomOf(0xa0), c, AES_128, good);
  sid[0] = toU8(toI32(sid[0]) ^ 1);
  refused(t, "session id not echoed", c, feed(c, TLS_LEVEL_INITIAL, wrongEcho), TLS_ALERT_ILLEGAL_PARAMETER);

  // A HelloRetryRequest.
  c = twoGroups(TLS_GROUP_X25519);
  const retry: u8[] = hello(retryRandom(), c, AES_128, join([retryShare(TLS_GROUP_SECP256R1), versions()]));
  t.eqI32("one retry is taken", feed(c, TLS_LEVEL_INITIAL, retry), ZERO);
  t.ok("a second hello goes out", toI32(c.takeOutput(TLS_LEVEL_INITIAL).length) > 0);
  refused(t, "a second retry", c, feed(c, TLS_LEVEL_INITIAL, retry), TLS_ALERT_UNEXPECTED_MESSAGE);
  c = twoGroups(TLS_GROUP_X25519);
  feed(c, TLS_LEVEL_INITIAL, hello(retryRandom(), c, AES_128, join([retryShare(TLS_GROUP_SECP256R1), versions()])));
  refused(t, "a suite changed after the retry", c, feed(c, TLS_LEVEL_INITIAL, hello(randomOf(0xa0), c, AES_256, join([share(TLS_GROUP_SECP256R1, leafPublic()), versions()]))), TLS_ALERT_ILLEGAL_PARAMETER);
  // A cookie the second hello echoes as the retry sent it (RFC 8446 §4.2.2).
  c = twoGroups(TLS_GROUP_X25519);
  const shortCookie: u8[] = [];
  u16(shortCookie, 16);
  append(shortCookie, counting(0xc0, 16));
  t.eqI32("a retry with a cookie", feed(c, TLS_LEVEL_INITIAL, hello(retryRandom(), c, AES_128, join([retryShare(TLS_GROUP_SECP256R1), versions(), ext(COOKIE, shortCookie)]))), ZERO);
  t.ok("a retry with a cookie: the second hello echoes it", holds(c.takeOutput(TLS_LEVEL_INITIAL), ext(COOKIE, shortCookie)));
  // A cookie so long that the hello echoing it cannot say its extensions' length.
  c = twoGroups(TLS_GROUP_X25519);
  const cookie: u8[] = [];
  u16(cookie, 65400);
  for (let k: i32 = 0; k < 65400; k++) {
    cookie.push(toU8(k & 0xff));
  }
  refused(t, "a cookie too long to echo", c, feed(c, TLS_LEVEL_INITIAL, hello(retryRandom(), c, AES_128, join([retryShare(TLS_GROUP_SECP256R1), versions(), ext(COOKIE, cookie)]))), TLS_ALERT_INTERNAL_ERROR);

  // secp256r1: the server's share is the leaf's public key, so the test
  // computes the server's side of the exchange from the leaf's private key.
  c = twoGroups(TLS_GROUP_SECP256R1);
  t.eqI32("a P-256 key share is taken", feed(c, TLS_LEVEL_INITIAL, hello(randomOf(0xa0), c, AES_128, join([share(TLS_GROUP_SECP256R1, leafPublic()), versions()]))), ZERO);
  t.eqI32("a P-256 key share: waits on EncryptedExtensions", c.state, TLS_CLIENT_STATE_WAIT_ENCRYPTED_EXTENSIONS);
  t.eqStr("a P-256 key share: the server's handshake secret", secretHex(c.secrets().handshake), p256HandshakeHex());
  c = twoGroups(TLS_GROUP_SECP256R1);
  const offCurve: u8[] = leafPublic();
  offCurve[64] = toU8(toI32(offCurve[64]) ^ 1);
  refused(t, "a P-256 share off the curve", c, feed(c, TLS_LEVEL_INITIAL, hello(randomOf(0xa0), c, AES_128, join([share(TLS_GROUP_SECP256R1, offCurve), versions()]))), TLS_ALERT_ILLEGAL_PARAMETER);
  c = twoGroups(TLS_GROUP_SECP256R1);
  // The point's length, with a compressed point's prefix byte.
  const compressed: u8[] = leafPublic();
  compressed[0] = 0x02;
  refused(t, "a compressed P-256 share", c, feed(c, TLS_LEVEL_INITIAL, hello(randomOf(0xa0), c, AES_128, join([share(TLS_GROUP_SECP256R1, compressed), versions()]))), TLS_ALERT_ILLEGAL_PARAMETER);
  // A HelloRetryRequest to secp256r1: the second hello carries the client's P-256 share.
  c = twoGroups(TLS_GROUP_X25519);
  t.eqI32("a retry to P-256", feed(c, TLS_LEVEL_INITIAL, hello(retryRandom(), c, AES_128, join([retryShare(TLS_GROUP_SECP256R1), versions()]))), ZERO);
  t.eqI32("a retry to P-256: the share's group", c.shareGroup, TLS_GROUP_SECP256R1);
  t.ok("a retry to P-256: the second hello carries the P-256 share", holds(c.takeOutput(TLS_LEVEL_INITIAL), clientP256Public()));
  t.eqI32("a retry to P-256: the ServerHello is taken", feed(c, TLS_LEVEL_INITIAL, hello(randomOf(0xa0), c, AES_128, join([share(TLS_GROUP_SECP256R1, leafPublic()), versions()]))), ZERO);
  t.eqStr("a retry to P-256: the server's handshake secret", secretHex(c.secrets().handshake), p256HandshakeHex());

  // EncryptedExtensions.
  c = afterHello();
  refused(t, "unoffered ALPN", c, feed(c, TLS_LEVEL_HANDSHAKE, encryptedExtensions(alpnOf("spdy/3"))), TLS_ALERT_ILLEGAL_PARAMETER);
  c = started(new TlsClientConfig("localhost", []));
  feed(c, TLS_LEVEL_INITIAL, hello(randomOf(0xa0), c, AES_128, goodExts()));
  refused(t, "ALPN when none was offered", c, feed(c, TLS_LEVEL_HANDSHAKE, encryptedExtensions(alpnOf("h2"))), TLS_ALERT_UNSUPPORTED_EXTENSION);
  const config = new TlsClientConfig("127.0.0.1", ["h2"]);
  c = started(config);
  feed(c, TLS_LEVEL_INITIAL, hello(randomOf(0xa0), c, AES_128, goodExts()));
  refused(t, "server_name acknowledged unsent", c, feed(c, TLS_LEVEL_HANDSHAKE, encryptedExtensions(ext(SERVER_NAME, []))), TLS_ALERT_UNSUPPORTED_EXTENSION);
  c = afterHello();
  refused(t, "an unsolicited extension in EncryptedExtensions", c, feed(c, TLS_LEVEL_HANDSHAKE, encryptedExtensions(ext(0x1234, []))), TLS_ALERT_UNSUPPORTED_EXTENSION);
  c = afterHello();
  refused(t, "key_share in EncryptedExtensions", c, feed(c, TLS_LEVEL_HANDSHAKE, encryptedExtensions(share(TLS_GROUP_X25519, serverPublic()))), TLS_ALERT_ILLEGAL_PARAMETER);
  c = afterHello();
  refused(t, "EncryptedExtensions at the Initial level", c, feed(c, TLS_LEVEL_INITIAL, encryptedExtensions([])), TLS_ALERT_UNEXPECTED_MESSAGE);

  // The ClientHello (§4.1.2): TLS 1.3 only, the three suites, the groups and
  // one share, the client's signature schemes, ALPN, and server_name for a
  // host name but not an IP literal (RFC 6066 §3).
  const ch: u8[] = firstHello(new TlsClientConfig("localhost", ["h2"]));
  t.eqI32("ClientHello: the message type", toI32(ch[0]), 1);
  t.eqI32("ClientHello: the length is the message's", messageEnd(ch, 0), toI32(ch.length));
  t.eqStr("ClientHello: legacy_version", toHex(part(ch, 4, 6)), "0303");
  t.eqStr("ClientHello: the random", toHex(part(ch, 6, 38)), toHex(counting(1, 32)));
  t.eqI32("ClientHello: a 32-byte legacy_session_id", toI32(ch[38]), 32);
  t.eqStr("ClientHello: the suites", toHex(helloSuites(ch)), "130113021303");
  t.eqStr("ClientHello: null compression only", toHex(helloCompression(ch)), "0100");
  t.eqStr("ClientHello: the extensions, in order", toHex(helloTypes(ch)), "0000000a000d0010002b0033");
  t.eqStr("ClientHello: server_name", helloExtHex(ch, SERVER_NAME), "000c0000096c6f63616c686f7374");
  t.eqStr("ClientHello: supported_groups", helloExtHex(ch, 0x000a), "0002001d");
  t.eqStr("ClientHello: signature_algorithms", helloExtHex(ch, 0x000d), "000a04030503080408050806");
  t.eqStr("ClientHello: ALPN", helloExtHex(ch, ALPN), "0003026832");
  t.eqStr("ClientHello: supported_versions", helloExtHex(ch, SUPPORTED_VERSIONS), "020304");
  t.eqStr("ClientHello: one x25519 share", helloExtHex(ch, KEY_SHARE), "0024001d0020" + toHex(clientX25519Public()));
  t.eqStr("ClientHello: no cookie", helloExtHex(ch, COOKIE), "absent");
  t.eqStr("ClientHello to an IPv4 literal: no server_name", helloExtHex(firstHello(new TlsClientConfig("127.0.0.1", ["h2"])), SERVER_NAME), "absent");
  t.eqStr("ClientHello to an IPv6 literal: no server_name", helloExtHex(firstHello(new TlsClientConfig("::1", ["h2"])), SERVER_NAME), "absent");
  t.eqStr("ClientHello with no ALPN: no ALPN extension", helloExtHex(firstHello(new TlsClientConfig("localhost", [])), ALPN), "absent");
  const both = new TlsClientConfig("localhost", ["h2", "http/1.1"]);
  both.groups = [TLS_GROUP_X25519, TLS_GROUP_SECP256R1];
  both.shareGroup = TLS_GROUP_SECP256R1;
  const ch2: u8[] = firstHello(both);
  t.eqStr("ClientHello offering both groups: supported_groups", helloExtHex(ch2, 0x000a), "0004001d0017");
  t.eqStr("ClientHello offering both groups: one P-256 share", helloExtHex(ch2, KEY_SHARE), "004500170041" + toHex(clientP256Public()));
  t.eqStr("ClientHello with two protocols: ALPN in order", helloExtHex(ch2, ALPN), "000c02683208687474702f312e31");

  // The hand-off at WAIT_AUTH: the caller gets the server's chain, its
  // scheme, the content and the signature, and checks them itself.
  let real = realUpTo(3);
  t.eqI32("at WAIT_AUTH", real.client.state, TLS_CLIENT_STATE_WAIT_AUTH);
  const chain: u8[][] = real.client.peerCertificates();
  t.eqI32("at WAIT_AUTH: one certificate", toI32(chain.length), 1);
  t.ok("at WAIT_AUTH: the leaf is the server's certificate", toI32(chain.length) === 1 && sameBytes(chain[0], leafCertificate()));
  t.eqI32("at WAIT_AUTH: the scheme", real.client.verifyScheme(), TLS_SIGNATURE_ECDSA_SECP256R1_SHA256);
  const content: u8[] = real.client.verifyContent();
  t.eqI32("at WAIT_AUTH: the content's length", toI32(content.length), 64 + 33 + 1 + 32);
  t.eqStr("at WAIT_AUTH: the content's prefix", toHex(part(content, 60, 98)), "20202020" + toHex(bytesOf("TLS 1.3, server CertificateVerify")) + "00");
  const rs: u8[] | null = x509DerSignatureRS(real.client.verifySignature());
  let raw: u8[] = [];
  if (rs !== null) {
    raw = rs;
  }
  t.eqI32("at WAIT_AUTH: the signature is DER r and s", toI32(raw.length), 64);
  t.ok("at WAIT_AUTH: the signature verifies under the leaf's key", p256VerifySha256(leafPublic(), content, raw));
  const flipped: u8[] = part(content, 0, toI32(content.length));
  flipped[100] = toU8(toI32(flipped[100]) ^ 1);
  t.ok("at WAIT_AUTH: not over other content", !p256VerifySha256(leafPublic(), flipped, raw));

  // Each message of a real flight moves the client one state on.
  const unstarted = new TlsClient(new TlsClientConfig("localhost", ["h2"]), counting(1, 32), counting(0x40, 32), counting(0x60, 32));
  t.eqI32("a new client: START", unstarted.state, TLS_CLIENT_STATE_START);
  t.eqI32("a new client: nothing to send at the application level", toI32(unstarted.takeOutput(TLS_LEVEL_APPLICATION).length), ZERO);
  t.eqI32("a started client", unstarted.start(), ZERO);
  t.eqI32("a started client: WAIT_SERVER_HELLO", unstarted.state, TLS_CLIENT_STATE_WAIT_SERVER_HELLO);
  refused(t, "a second start", unstarted, unstarted.start(), TLS_ALERT_INTERNAL_ERROR);
  t.eqI32("a second start: start answers the alert", unstarted.start(), TLS_ALERT_INTERNAL_ERROR);
  t.eqI32("after the ServerHello: WAIT_ENCRYPTED_EXTENSIONS", realUpTo(0).client.state, TLS_CLIENT_STATE_WAIT_ENCRYPTED_EXTENSIONS);
  t.eqI32("after EncryptedExtensions: WAIT_CERTIFICATE", realUpTo(1).client.state, TLS_CLIENT_STATE_WAIT_CERTIFICATE);
  t.eqI32("after the Certificate: WAIT_CERTIFICATE_VERIFY", realUpTo(2).client.state, TLS_CLIENT_STATE_WAIT_CERTIFICATE_VERIFY);
  real = realUpTo(2);
  refused(t, "a verdict before one is due", real.client, real.client.authenticate(true), TLS_ALERT_INTERNAL_ERROR);
  t.eqI32("a verdict before one is due: authenticate answers the alert", real.client.authenticate(true), TLS_ALERT_INTERNAL_ERROR);

  // An IP literal is any name with a colon, or one of only digits and dots.
  t.ok("an IP literal: 127.0.0.1", tlsClientIsIpLiteral("127.0.0.1"));
  t.ok("an IP literal: ::1", tlsClientIsIpLiteral("::1"));
  t.ok("an IP literal: 1234", tlsClientIsIpLiteral("1234"));
  t.ok("not an IP literal: localhost", !tlsClientIsIpLiteral("localhost"));
  t.ok("not an IP literal: a.b", !tlsClientIsIpLiteral("a.b"));
  t.ok("not an IP literal: the empty name", !tlsClientIsIpLiteral(""));

  // Out of order and the Finished, against a real server's flight.
  real = new Real();
  feed(real.client, TLS_LEVEL_INITIAL, real.serverHello);
  const eeLength: i32 = 4 + ((toI32(real.flight[1]) << 16) | (toI32(real.flight[2]) << 8) | toI32(real.flight[3]));
  const skipped: i32 = real.client.receive(TLS_LEVEL_HANDSHAKE, real.flight, eeLength, toI32(real.flight.length) - eeLength);
  refused(t, "Certificate before EncryptedExtensions", real.client, skipped, TLS_ALERT_UNEXPECTED_MESSAGE);
  c = fresh();
  refused(t, "a Finished first", c, feed(c, TLS_LEVEL_INITIAL, message(20, counting(0, 32))), TLS_ALERT_UNEXPECTED_MESSAGE);
  real = new Real();
  feed(real.client, TLS_LEVEL_INITIAL, real.serverHello);
  const last: i32 = toI32(real.flight.length) - 1;
  real.flight[last] = toU8(toI32(real.flight[last]) ^ 1);
  t.eqI32("a bad Finished is held", feed(real.client, TLS_LEVEL_HANDSHAKE, real.flight), ZERO);
  t.eqI32("waits on the caller", real.client.state, TLS_CLIENT_STATE_WAIT_AUTH);
  t.eqI32("waits on the caller: no Finished before the verdict", toI32(real.client.takeOutput(TLS_LEVEL_HANDSHAKE).length), ZERO);
  refused(t, "a bad Finished", real.client, real.client.authenticate(true), TLS_ALERT_DECRYPT_ERROR);
  real = new Real();
  feed(real.client, TLS_LEVEL_INITIAL, real.serverHello);
  feed(real.client, TLS_LEVEL_HANDSHAKE, real.flight);
  refused(t, "the caller refuses the chain", real.client, real.client.authenticate(false), TLS_ALERT_BAD_CERTIFICATE);

  // A low-order x25519 share: the shared secret is all zeros (RFC 7748 §6.1).
  c = fresh();
  const lowOrder: u8[] = new Array<u8>(32);
  refused(t, "an all-zero x25519 share", c, feed(c, TLS_LEVEL_INITIAL, hello(randomOf(0xa0), c, AES_128, join([share(TLS_GROUP_X25519, lowOrder), versions()]))), TLS_ALERT_ILLEGAL_PARAMETER);

  // A retry must change the second hello (§4.1.4); a cookie alone does.
  c = twoGroups(TLS_GROUP_X25519);
  refused(t, "a retry with neither key_share nor cookie", c, feed(c, TLS_LEVEL_INITIAL, hello(retryRandom(), c, AES_128, versions())), TLS_ALERT_ILLEGAL_PARAMETER);
  c = twoGroups(TLS_GROUP_X25519);
  t.eqI32("a retry with only a cookie", feed(c, TLS_LEVEL_INITIAL, hello(retryRandom(), c, AES_128, join([versions(), ext(COOKIE, shortCookie)]))), ZERO);
  t.eqI32("a retry with only a cookie: the share's group stays", c.shareGroup, TLS_GROUP_X25519);
  t.ok("a retry with only a cookie: the second hello echoes it", holds(c.takeOutput(TLS_LEVEL_INITIAL), ext(COOKIE, shortCookie)));

  // No client certificates: a CertificateRequest is not answered.
  real = realUpTo(1);
  refused(t, "a CertificateRequest", real.client, feed(real.client, TLS_LEVEL_HANDSHAKE, message(13, [0x00, 0x00, 0x00])), TLS_ALERT_UNEXPECTED_MESSAGE);

  // Certificate (§4.4.2): at least one entry, an empty request context, and
  // no entry extension the client did not ask for.
  real = realUpTo(1);
  refused(t, "a Certificate with no entries", real.client, feed(real.client, TLS_LEVEL_HANDSHAKE, message(11, [0x00, 0x00, 0x00, 0x00])), TLS_ALERT_DECODE_ERROR);
  real = realUpTo(1);
  const withContext: u8[] = [0x01, 0xaa];
  const certificate: u8[] = realBody(real, 1);
  append(withContext, part(certificate, 1, toI32(certificate.length)));
  refused(t, "a Certificate with a request context", real.client, feed(real.client, TLS_LEVEL_HANDSHAKE, message(11, withContext)), TLS_ALERT_ILLEGAL_PARAMETER);
  real = realUpTo(1);
  const listLength: i32 = ((toI32(certificate[1]) << 16) | (toI32(certificate[2]) << 8) | toI32(certificate[3])) + 4;
  const withExtension: u8[] = [0x00, toU8(listLength >> 16), toU8((listLength >> 8) & 0xff), toU8(listLength & 0xff)];
  append(withExtension, part(certificate, 4, toI32(certificate.length) - 2));
  append(withExtension, [0x00, 0x04]);
  append(withExtension, ext(ALPN, []));
  refused(t, "a Certificate entry with an extension", real.client, feed(real.client, TLS_LEVEL_HANDSHAKE, message(11, withExtension)), TLS_ALERT_UNSUPPORTED_EXTENSION);

  // CertificateVerify: the signature's length is the message's.
  real = realUpTo(2);
  const verify: u8[] = realBody(real, 2);
  refused(t, "a CertificateVerify cut short", real.client, feed(real.client, TLS_LEVEL_HANDSHAKE, message(15, part(verify, 0, toI32(verify.length) - 1))), TLS_ALERT_DECODE_ERROR);
  real = realUpTo(2);
  const unoffered: u8[] = part(verify, 0, toI32(verify.length));
  unoffered[0] = 0x02;
  unoffered[1] = 0x01;
  refused(t, "a CertificateVerify with a scheme not offered", real.client, feed(real.client, TLS_LEVEL_HANDSHAKE, message(15, unoffered)), TLS_ALERT_ILLEGAL_PARAMETER);
  real = realUpTo(2);
  const longer: u8[] = part(verify, 0, toI32(verify.length));
  longer.push(0x00);
  refused(t, "a CertificateVerify with bytes after it", real.client, feed(real.client, TLS_LEVEL_HANDSHAKE, message(15, longer)), TLS_ALERT_DECODE_ERROR);

  // `reject` sends the caller's alert, `bad_certificate` for one outside 1 to 255.
  real = realUpTo(3);
  refused(t, "the caller's own alert", real.client, real.client.reject(CERTIFICATE_EXPIRED), CERTIFICATE_EXPIRED);
  real = realUpTo(3);
  refused(t, "an alert out of range", real.client, real.client.reject(300), TLS_ALERT_BAD_CERTIFICATE);
  real = realUpTo(3);
  refused(t, "alert 0", real.client, real.client.reject(0), TLS_ALERT_BAD_CERTIFICATE);
  real = realUpTo(3);
  refused(t, "alert 256", real.client, real.client.reject(256), TLS_ALERT_BAD_CERTIFICATE);
  real = realUpTo(3);
  refused(t, "alert 255", real.client, real.client.reject(255), 255);
  t.eqI32("alert 255: authenticate answers it", real.client.authenticate(true), 255);
  c = fresh();
  refused(t, "a refusal before one is due", c, c.reject(CERTIFICATE_EXPIRED), TLS_ALERT_INTERNAL_ERROR);

  // After the handshake a NewSessionTicket is checked and dropped (§4.6.1):
  // no client-side resumption.
  real = realUpTo(4);
  t.eqI32("connected", real.client.authenticate(true), ZERO);
  const ticket: u8[] = [0x00, 0x00, 0x0e, 0x10, 0x01, 0x02, 0x03, 0x04, 0x01, 0x00, 0x00, 0x01, 0xaa, 0x00, 0x00];
  t.eqI32("a NewSessionTicket is dropped", feed(real.client, TLS_LEVEL_APPLICATION, message(4, ticket)), ZERO);
  t.eqI32("a NewSessionTicket is dropped: still connected", real.client.state, TLS_CLIENT_STATE_CONNECTED);
  refused(t, "a NewSessionTicket with no ticket", real.client, feed(real.client, TLS_LEVEL_APPLICATION, message(4, [0x00, 0x00, 0x0e, 0x10, 0x01, 0x02, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00])), TLS_ALERT_DECODE_ERROR);

  // A wiped client goes no further.
  c = fresh();
  c.wipe();
  refused(t, "a wiped client", c, feed(c, TLS_LEVEL_INITIAL, hello(randomOf(0xa0), c, AES_128, goodExts())), TLS_ALERT_INTERNAL_ERROR);
  return t.done();
};
