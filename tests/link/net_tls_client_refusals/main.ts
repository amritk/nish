// The server flights `nish/net/tls/client` refuses, each with its alert: a
// ServerHello built byte by byte (so it can be broken), or a real server's
// flight with one thing changed. Every case starts a fresh client.
import { Suite } from "nish/testing";
import { TLS_LEVEL_HANDSHAKE, TLS_LEVEL_INITIAL, TlsServer } from "nish/net/tls";
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
} from "nish/net/tls/codec";
import { TLS_CLIENT_STATE_FAILED, TLS_CLIENT_STATE_WAIT_AUTH, TlsClient, TlsClientConfig } from "nish/net/tls/client";
import { x25519BasePlain } from "../crypto_x25519/plain";
import { fromHex } from "../crypto_x509/hex";
import { leafPublic, newServer, serverPrivate, signWithLeaf, tcpConfig } from "../net_tls_common/server";

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
  // A cookie so long that the hello echoing it cannot say its extensions' length.
  c = twoGroups(TLS_GROUP_X25519);
  const cookie: u8[] = [];
  u16(cookie, 65400);
  for (let k: i32 = 0; k < 65400; k++) {
    cookie.push(toU8(k & 0xff));
  }
  refused(t, "a cookie too long to echo", c, feed(c, TLS_LEVEL_INITIAL, hello(retryRandom(), c, AES_128, join([retryShare(TLS_GROUP_SECP256R1), versions(), ext(COOKIE, cookie)]))), TLS_ALERT_INTERNAL_ERROR);

  // secp256r1: the share is offered and taken, but no ECDH computes it.
  c = twoGroups(TLS_GROUP_SECP256R1);
  refused(t, "a P-256 key share", c, feed(c, TLS_LEVEL_INITIAL, hello(randomOf(0xa0), c, AES_128, join([share(TLS_GROUP_SECP256R1, leafPublic()), versions()]))), TLS_ALERT_INTERNAL_ERROR);

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
  refused(t, "EncryptedExtensions at the Initial level", c, feed(c, TLS_LEVEL_INITIAL, encryptedExtensions([])), TLS_ALERT_UNEXPECTED_MESSAGE);

  // Out of order and the Finished, against a real server's flight.
  let real = new Real();
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
  refused(t, "a bad Finished", real.client, real.client.authenticate(true), TLS_ALERT_DECRYPT_ERROR);
  real = new Real();
  feed(real.client, TLS_LEVEL_INITIAL, real.serverHello);
  feed(real.client, TLS_LEVEL_HANDSHAKE, real.flight);
  refused(t, "the caller refuses the chain", real.client, real.client.authenticate(false), TLS_ALERT_BAD_CERTIFICATE);
  return t.done();
};
