// `nish/net/tls-client` against `nish/net/tls`'s server in process: each
// suite, with and without ALPN, the HelloRetryRequest path, the secrets both
// ends derive agreeing byte for byte, and every refusal of the client, each
// fed a server message recorded from a real handshake and then changed in the
// one way the refusal is about.
import { Suite } from "nish/testing";
import { TLS_LEVEL_APPLICATION, TLS_LEVEL_HANDSHAKE, TLS_LEVEL_INITIAL, TLS_STATE_CONNECTED, TlsServer } from "nish/net/tls";
import {
  TLS_CLIENT_STATE_CONNECTED,
  TLS_CLIENT_STATE_FAILED,
  TLS_CLIENT_STATE_WAIT_AUTHENTICATION,
  TLS_CLIENT_STATE_WAIT_SERVER_HELLO,
  TlsClient,
  TlsClientConfig,
} from "nish/net/tls-client";
import { bytesFrom, cat, clientPrivate, clientRandom, extAlpn, extServerName, extension, serverShareOf, splitMessages, u16, vec16, vec24, vec8 } from "../net_tls_common/client";
import { exporterHex, readCopy, writeCopy } from "../net_tls_common/held";
import { secretHex } from "../net_tls_common/secrets";
import { leafCertificate, newServer, tcpConfig } from "../net_tls_common/server";
import { fromHex, sameBytes, toHex } from "../crypto_x509/hex";
import { Outcome, PinnedLeaf, authenticatePinned, clientConfig, newClient, runHandshake } from "./harness";

/** All three suites, in the client's default order. */
const all = (): i32[] => [0x1301, 0x1302, 0x1303];

/** No ALPN. */
const noAlpn = (): string[] => {
  const none: string[] = [];
  return none;
};

/** The ALPN list both ends offer when a test wants one. */
const h2 = (): string[] => ["h2", "http/1.1"];

/** No bytes. */
const empty = (): u8[] => {
  const none: u8[] = [];
  return none;
};
const HRR_RANDOM: string = "cf21ad74e59a6111be1d8c021e65b891c2a211167abb8c5e079e09e2c8a8339c";

/** A handshake message of `type` around `body`. */
const message = (type: i32, body: u8[]): u8[] => cat([[toU8(type)], vec24(body)]);

/** A ServerHello (or, with the retry random, a HelloRetryRequest) with every field the caller's. */
const serverHello = (legacy: i32, random: u8[], sessionId: u8[], suite: i32, compression: i32, extensions: u8[][]): u8[] =>
  message(2, cat([u16(legacy), random, vec8(sessionId), u16(suite), [toU8(compression)], vec16(cat(extensions))]));

/** A server's `key_share`: `group` and `key`. */
const shareOf = (group: i32, key: u8[]): u8[] => extension(51, cat([u16(group), vec16(key)]));

/** `supported_versions` as a server sends it. */
const versionOf = (version: i32): u8[] => extension(43, u16(version));

/** 32 bytes of `value`, with the last eight replaced by `tail` when it is not empty. */
const randomWith = (value: i32, tail: string): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < 32; k++) {
    out.push(toU8(value));
  }
  const t: u8[] = fromHex(tail);
  for (let k: i32 = 0; k < toI32(t.length); k++) {
    out[24 + k] = t[k];
  }
  return out;
};

/** The first `n` bytes of `bytes`. */
const firstBytes = (bytes: u8[], n: i32): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < n && k < toI32(bytes.length); k++) {
    out.push(bytes[k]);
  }
  return out;
};

/** A copy of `bytes` with byte `at` exclusive-ored with 1. */
const flipped = (bytes: u8[], at: i32): u8[] => {
  const out: u8[] = bytesFrom(bytes, 0);
  out[at] = toU8(toI32(out[at]) ^ 1);
  return out;
};

/** A started client under `config`. */
const started = (config: TlsClientConfig): TlsClient => {
  const client: TlsClient = newClient(config);
  client.start();
  return client;
};

/** Hands `bytes` to `client` at `level`, whole; the alert. */
const feed = (client: TlsClient, level: i32, bytes: u8[]): i32 => client.receive(level, bytes, toI32(0), toI32(bytes.length));

/** Feeds each of `messages` at the Handshake level in turn, stopping at the first alert; the alert. */
const feedAll = (client: TlsClient, messages: u8[][]): i32 => {
  for (const m of messages) {
    const alert: i32 = feed(client, TLS_LEVEL_HANDSHAKE, m);
    if (alert !== 0) {
      return alert;
    }
  }
  return 0;
};

/** One handshake under `suites`, the client's and server's ALPN and `deferShare`; both ends must agree. */
const handshakeCase = (t: Suite, label: string, suites: i32[], alpn: string[], serverAlpn: string[], deferShare: boolean): void => {
  const client: TlsClient = newClient(clientConfig(suites, alpn, deferShare));
  const server: TlsServer = newServer(tcpConfig(serverAlpn));
  const auth = new PinnedLeaf();
  const outcome: Outcome = runHandshake(client, server, auth);
  t.eqI32(`${label}: client alert`, outcome.clientAlert, toI32(0));
  t.eqI32(`${label}: server alert`, outcome.serverAlert, toI32(0));
  t.eqI32(`${label}: client connected`, client.state, TLS_CLIENT_STATE_CONNECTED);
  t.eqI32(`${label}: server connected`, server.state, TLS_STATE_CONNECTED);
  t.eqI32(`${label}: one chain check`, auth.chainCalls, toI32(1));
  t.eqI32(`${label}: one signature check`, auth.signatureCalls, toI32(1));
  t.eqI32(`${label}: suite`, client.suite, suites[0]);
  const both: boolean = toI32(alpn.length) > 0 && toI32(serverAlpn.length) > 0;
  t.eqStr(`${label}: alpn`, client.alpn, both ? serverAlpn[0] : "");
  t.eqStr(`${label}: exporter agrees`, secretHex(client.secrets().exporter), exporterHex(server));
  t.eqStr(
    `${label}: what the client writes the server reads`,
    secretHex(client.secrets().clientApplication),
    toHex(readCopy(server, TLS_LEVEL_APPLICATION))
  );
  t.eqStr(
    `${label}: what the server writes the client reads`,
    secretHex(client.secrets().serverApplication),
    toHex(writeCopy(server, TLS_LEVEL_APPLICATION))
  );
  t.ok(`${label}: both application secrets known`, client.readKnown(TLS_LEVEL_APPLICATION) && client.writeKnown(TLS_LEVEL_APPLICATION));
  t.ok(
    `${label}: the handshake secrets stay for the carrier`,
    client.readKnown(TLS_LEVEL_HANDSHAKE) && client.writeKnown(TLS_LEVEL_HANDSHAKE)
  );
  t.eqI32(`${label}: nothing more to send`, toI32(client.takeOutput(TLS_LEVEL_HANDSHAKE).length), toI32(0));
};

/** The server's messages of one plain handshake under `suites` and ALPN, for the refusals to change. */
class Recording {
  serverHello: u8[];
  flight: u8[][];

  constructor(suites: i32[], alpn: string[], deferShare: boolean) {
    const server: TlsServer = newServer(tcpConfig(alpn));
    const outcome: Outcome = runHandshake(newClient(clientConfig(suites, alpn, deferShare)), server, new PinnedLeaf());
    this.serverHello = outcome.serverInitial;
    this.flight = splitMessages(outcome.serverHandshake);
  }
}

/** A client that has taken `rec`'s ServerHello. */
const afterHello = (config: TlsClientConfig, rec: Recording): TlsClient => {
  const client: TlsClient = started(config);
  feed(client, TLS_LEVEL_INITIAL, rec.serverHello);
  return client;
};

/** `rec`'s flight with message `index` replaced by `replacement`. */
const flightWith = (rec: Recording, index: i32, replacement: u8[]): u8[][] => {
  const out: u8[][] = [];
  for (let k: i32 = 0; k < toI32(rec.flight.length); k++) {
    out.push(k === index ? replacement : rec.flight[k]);
  }
  return out;
};

/** A client built from `config`, `random` and `key` must refuse to start with `internal_error`. */
const refused = (t: Suite, label: string, config: TlsClientConfig, random: u8[], key: u8[]): void => {
  t.eqI32(label, new TlsClient(config, random, key).start(), toI32(80));
};

/** A fresh client offering AES-128-GCM must answer `sh` with `expected`, failing unless it is 0. */
const hello = (t: Suite, label: string, sh: u8[], expected: i32): void => {
  const client: TlsClient = started(clientConfig([0x1301], noAlpn(), false));
  t.eqI32(label, feed(client, TLS_LEVEL_INITIAL, sh), expected);
  t.eqBool(`${label}: failed`, client.state === TLS_CLIENT_STATE_FAILED, expected !== 0);
};

/** A HelloRetryRequest for `suite` with `extensions`. */
const hrr = (suite: i32, extensions: u8[][]): u8[] => serverHello(0x0303, fromHex(HRR_RANDOM), empty(), suite, 0, extensions);

/** A fresh client under `config` must answer `message` at the Initial level with `expected`. */
const refuse = (t: Suite, label: string, config: TlsClientConfig, message: u8[], expected: i32): void => {
  t.eqI32(label, feed(started(config), TLS_LEVEL_INITIAL, message), expected);
};

/** The configuration the flight refusals run under: AES-128-GCM with ALPN. */
const flightConfig = (): TlsClientConfig => clientConfig([0x1301], h2(), false);

/** A client past `rec`'s ServerHello must answer `messages` with `expected`. */
const flight = (t: Suite, rec: Recording, label: string, messages: u8[][], expected: i32): void => {
  t.eqI32(label, feedAll(afterHello(flightConfig(), rec), messages), expected);
};

/** EncryptedExtensions with `extensions`. */
const ee = (extensions: u8[][]): u8[] => message(8, vec16(cat(extensions)));

/** A Certificate with `context` and the encoded `entries`. */
const certificate = (context: u8[], entries: u8[]): u8[] => message(11, cat([vec8(context), vec24(entries)]));

/** `rec`'s CertificateVerify under `scheme`. */
const cv = (rec: Recording, scheme: i32): u8[] => message(15, cat([u16(scheme), vec16(bytesFrom(rec.flight[2], 8))]));

/** A client waiting on the caller after `rec`'s flight must answer `authenticate(chainAlert, signatureValid)` with `expected` and fail. */
const decide = (t: Suite, rec: Recording, label: string, chainAlert: i32, signatureValid: boolean, expected: i32): void => {
  const client: TlsClient = afterHello(flightConfig(), rec);
  feedAll(client, rec.flight);
  t.eqI32(label, client.authenticate(chainAlert, signatureValid), expected);
  t.eqI32(`${label}: failed`, client.state, TLS_CLIENT_STATE_FAILED);
  t.eqI32(`${label}: nothing to send`, toI32(client.takeOutput(TLS_LEVEL_HANDSHAKE).length), toI32(0));
};

/** A client authenticated after `rec`'s flight up to CertificateVerify must answer `finished` with `expected`. */
const finish = (t: Suite, rec: Recording, label: string, finished: u8[], expected: i32): void => {
  const client: TlsClient = afterHello(flightConfig(), rec);
  feedAll(client, [rec.flight[0], rec.flight[1], rec.flight[2]]);
  authenticatePinned(client, new PinnedLeaf());
  t.eqI32(label, feed(client, TLS_LEVEL_HANDSHAKE, finished), expected);
};

/** The configuration and constructor refusals: each client fails at once, `start` answers `internal_error`. */
const configChecks = (t: Suite): void => {
  const base: TlsClientConfig = clientConfig(all(), h2(), false);
  refused(t, "a 31-byte random", base, bytesFrom(clientRandom(), 1), clientPrivate());
  refused(t, "a 31-byte key", base, clientRandom(), bytesFrom(clientPrivate(), 1));
  const noSuites: i32[] = [];
  refused(t, "no suites", clientConfig(noSuites, h2(), false), clientRandom(), clientPrivate());
  refused(t, "a suite the client does not know", clientConfig([0x1301, 0x1304], h2(), false), clientRandom(), clientPrivate());
  refused(t, "an empty ALPN name", clientConfig(all(), [""], false), clientRandom(), clientPrivate());
  let long: string = "";
  for (let k: i32 = 0; k < 256; k++) {
    long = long + "a";
  }
  refused(t, "an ALPN name of 256 bytes", clientConfig(all(), [long], false), clientRandom(), clientPrivate());
  let name: string = "a";
  while (toI32(name.length) < 254) {
    name = name + "a";
  }
  refused(t, "a name of 254 characters", { serverName: name, alpn: h2(), suites: all(), deferShare: false }, clientRandom(), clientPrivate());
  let longLabel: string = "";
  for (let k: i32 = 0; k < 64; k++) {
    longLabel = longLabel + "b";
  }
  refused(t, "a label of 64 bytes", { serverName: longLabel + ".test", alpn: h2(), suites: all(), deferShare: false }, clientRandom(), clientPrivate());
  refused(t, "a name ending in a dot", { serverName: "localhost.", alpn: h2(), suites: all(), deferShare: false }, clientRandom(), clientPrivate());
  refused(t, "a name with a space", { serverName: "local host", alpn: h2(), suites: all(), deferShare: false }, clientRandom(), clientPrivate());
  refused(t, "a name with an empty label", { serverName: "a..b", alpn: h2(), suites: all(), deferShare: false }, clientRandom(), clientPrivate());
  const twice: TlsClient = started(base);
  t.eqI32("start twice", twice.start(), toI32(80));
  t.eqI32("a client that failed answers its alert again", twice.start(), toI32(80));
  t.eqI32("...and to bytes", feed(twice, TLS_LEVEL_INITIAL, [toU8(2)]), toI32(80));
  const ip: TlsClient = started({ serverName: "127.0.0.1", alpn: h2(), suites: all(), deferShare: false });
  t.eqStr("an IPv4 literal sends no SNI", ip.sniName, "");
  const ip6: TlsClient = started({ serverName: "::1", alpn: h2(), suites: all(), deferShare: false });
  t.eqStr("an IPv6 literal sends no SNI", ip6.sniName, "");
  const dns: TlsClient = started(base);
  t.eqStr("a DNS name is sent", dns.sniName, "localhost");
  t.eqBool("the hello is written", toI32(dns.takeOutput(TLS_LEVEL_INITIAL).length) > 0, true);
  t.eqI32("and taken once", toI32(dns.takeOutput(TLS_LEVEL_INITIAL).length), toI32(0));
};

/** Every ServerHello refusal. */
const serverHelloChecks = (t: Suite, rec: Recording): void => {
  const config: TlsClientConfig = clientConfig([0x1301], noAlpn(), false);
  const share: u8[] = serverShareOf(rec.serverHello);
  const none: u8[] = [];
  const good: u8[][] = [shareOf(29, share), versionOf(0x0304)];
  hello(t, "rebuilt ServerHello is accepted", serverHello(0x0303, randomWith(7, ""), none, 0x1301, 0, good), 0);
  hello(t, "a suite not offered", serverHello(0x0303, randomWith(7, ""), none, 0x1302, 0, good), 47);
  hello(t, "a legacy version other than 1.2", serverHello(0x0302, randomWith(7, ""), none, 0x1301, 0, good), 70);
  hello(t, "a TLS 1.2 ServerHello", serverHello(0x0303, randomWith(7, ""), none, 0x1301, 0, [shareOf(29, share)]), 70);
  hello(t, "the TLS 1.2 downgrade sentinel", serverHello(0x0303, randomWith(7, "444f574e47524401"), none, 0x1301, 0, good), 47);
  hello(t, "the TLS 1.1 downgrade sentinel", serverHello(0x0303, randomWith(7, "444f574e47524400"), none, 0x1301, 0, good), 47);
  hello(
    t,
    "the sentinel on a TLS 1.2 ServerHello",
    serverHello(0x0303, randomWith(7, "444f574e47524401"), none, 0x1301, 0, [shareOf(29, share)]),
    47
  );
  hello(t, "supported_versions 1.2", serverHello(0x0303, randomWith(7, ""), none, 0x1301, 0, [shareOf(29, share), versionOf(0x0303)]), 47);
  hello(t, "a compression method", serverHello(0x0303, randomWith(7, ""), none, 0x1301, 1, good), 47);
  hello(t, "a session id the client did not send", serverHello(0x0303, randomWith(7, ""), [toU8(1)], 0x1301, 0, good), 47);
  hello(t, "no key_share", serverHello(0x0303, randomWith(7, ""), none, 0x1301, 0, [versionOf(0x0304)]), 109);
  hello(t, "an extension not offered", serverHello(0x0303, randomWith(7, ""), none, 0x1301, 0, [shareOf(29, share), versionOf(0x0304), extension(0x7a7a, none)]), 110);
  hello(t, "a duplicate extension", serverHello(0x0303, randomWith(7, ""), none, 0x1301, 0, [shareOf(29, share), shareOf(29, share), versionOf(0x0304)]), 47);
  hello(t, "a share of 31 bytes", serverHello(0x0303, randomWith(7, ""), none, 0x1301, 0, [shareOf(29, bytesFrom(share, 1)), versionOf(0x0304)]), 47);
  hello(t, "a share for secp256r1", serverHello(0x0303, randomWith(7, ""), none, 0x1301, 0, [shareOf(23, share), versionOf(0x0304)]), 47);
  hello(t, "an all-zero share", serverHello(0x0303, randomWith(7, ""), none, 0x1301, 0, [shareOf(29, randomWith(0, "")), versionOf(0x0304)]), 47);
  hello(t, "a ServerHello cut short waits for the rest", firstBytes(rec.serverHello, 30), 0);
  const cut: u8[] = cat([[toU8(2), toU8(0), toU8(0), toU8(30)], firstBytes(bytesFrom(rec.serverHello, 4), 30)]);
  hello(t, "a ServerHello whose body ends early", cut, 50);
  hello(t, "EncryptedExtensions instead", rec.flight[0], 10);
  hello(t, "bytes after the ServerHello", cat([rec.serverHello, [toU8(8), toU8(0), toU8(0), toU8(2), toU8(0), toU8(0)]]), 10);
  hello(t, "a header longer than 64 KiB", [toU8(2), toU8(1), toU8(0), toU8(1)], 50);
  const level: TlsClient = started(config);
  t.eqI32("the ServerHello at the Handshake level", feed(level, TLS_LEVEL_HANDSHAKE, rec.serverHello), toI32(10));
  const window: TlsClient = started(config);
  t.eqI32("a window past the end", window.receive(TLS_LEVEL_INITIAL, rec.serverHello, toI32(4), toI32(rec.serverHello.length)), toI32(80));
  const negative: TlsClient = started(config);
  t.eqI32("a negative offset", negative.receive(TLS_LEVEL_INITIAL, rec.serverHello, toI32(-1), toI32(4)), toI32(80));
  const empty: TlsClient = started(config);
  t.eqI32("no bytes is not an error", empty.receive(TLS_LEVEL_INITIAL, rec.serverHello, toI32(0), toI32(0)), toI32(0));
  t.eqI32("...and changes nothing", empty.state, TLS_CLIENT_STATE_WAIT_SERVER_HELLO);
  const early: TlsClient = newClient(config);
  t.eqI32("bytes before start", feed(early, TLS_LEVEL_INITIAL, rec.serverHello), toI32(10));
  const split: TlsClient = started(config);
  const n: i32 = toI32(rec.serverHello.length);
  let alert: i32 = 0;
  for (let k: i32 = 0; k < n; k++) {
    alert = alert | split.receive(TLS_LEVEL_INITIAL, rec.serverHello, k, toI32(1));
  }
  t.eqI32("the ServerHello a byte at a time", alert, toI32(0));
  t.ok("...derives the handshake secrets", split.readKnown(TLS_LEVEL_HANDSHAKE));
};

/** The HelloRetryRequest path and its refusals. */
const retryChecks = (t: Suite): void => {
  const none: u8[] = [];
  const x25519: u8[][] = [extension(51, u16(29)), versionOf(0x0304)];
  const deferred: TlsClientConfig = clientConfig(all(), noAlpn(), true);
  const asked: TlsClient = started(deferred);
  const first: u8[] = asked.takeOutput(TLS_LEVEL_INITIAL);
  t.eqI32("a retry for x25519", feed(asked, TLS_LEVEL_INITIAL, hrr(0x1301, x25519)), toI32(0));
  const second: u8[] = asked.takeOutput(TLS_LEVEL_INITIAL);
  t.ok("...sends a second ClientHello, longer by the share", toI32(second.length) > toI32(first.length));
  t.eqI32("a second retry", feed(asked, TLS_LEVEL_INITIAL, hrr(0x1301, x25519)), toI32(10));
  const cookie: TlsClient = started(deferred);
  cookie.takeOutput(TLS_LEVEL_INITIAL);
  const withCookie: u8[][] = [extension(51, u16(29)), versionOf(0x0304), extension(44, vec16([toU8(1), toU8(2), toU8(3)]))];
  t.eqI32("a retry with a cookie", feed(cookie, TLS_LEVEL_INITIAL, hrr(0x1301, withCookie)), toI32(0));
  const echoed: string = toHex(cookie.takeOutput(TLS_LEVEL_INITIAL));
  t.contains("...echoes it", echoed, "002c00050003010203");
  refuse(t, "a retry for secp256r1", deferred, hrr(0x1301, [extension(51, u16(23)), versionOf(0x0304)]), 47);
  refuse(t, "a retry for the share already sent", clientConfig(all(), noAlpn(), false), hrr(0x1301, x25519), 47);
  refuse(t, "a retry that changes nothing", deferred, hrr(0x1301, [versionOf(0x0304)]), 47);
  refuse(t, "a retry for a suite not offered", clientConfig([0x1301], noAlpn(), true), hrr(0x1302, x25519), 47);
  const switched: TlsClient = started(deferred);
  feed(switched, TLS_LEVEL_INITIAL, hrr(0x1301, x25519));
  const share: u8[] = randomWith(9, "");
  t.eqI32(
    "a ServerHello whose suite is not the retry's",
    feed(switched, TLS_LEVEL_INITIAL, serverHello(0x0303, randomWith(7, ""), none, 0x1302, 0, [shareOf(29, share), versionOf(0x0304)])),
    toI32(47)
  );
};

/** The refusals of EncryptedExtensions, Certificate, CertificateVerify, the hand-off and Finished. */
const flightChecks = (t: Suite, rec: Recording): void => {
  const config: TlsClientConfig = flightConfig();
  const none: u8[] = empty();
  t.eqI32("the recorded flight", feedAll(afterHello(config, rec), rec.flight), toI32(0));
  flight(t, rec, "an ALPN not offered", flightWith(rec, 0, ee([extAlpn(["spdy/3"])])), 47);
  flight(t, rec, "two ALPN protocols", flightWith(rec, 0, ee([extAlpn(["h2", "http/1.1"])])), 47);
  flight(t, rec, "a server_name with a body", flightWith(rec, 0, ee([extServerName("localhost")])), 50);
  flight(t, rec, "an empty server_name", flightWith(rec, 0, ee([extension(0, none)])), 0);
  flight(t, rec, "key_share in EncryptedExtensions", flightWith(rec, 0, ee([extension(51, u16(29))])), 47);
  flight(t, rec, "an extension not offered", flightWith(rec, 0, ee([extension(0x7a7a, none)])), 110);
  flight(t, rec, "EncryptedExtensions cut short", flightWith(rec, 0, message(8, [toU8(0), toU8(4)])), 50);
  flight(t, rec, "a CertificateRequest", [rec.flight[0], message(13, cat([vec8(none), vec16(none)]))], 10);
  flight(t, rec, "CertificateVerify before Certificate", [rec.flight[0], rec.flight[2]], 10);
  flight(t, rec, "Finished before Certificate", [rec.flight[0], rec.flight[3]], 10);
  const entry: u8[] = cat([vec24(leafCertificate()), vec16(none)]);
  flight(t, rec, "an empty certificate list", flightWith(rec, 1, certificate(none, none)), 50);
  flight(t, rec, "a certificate request context", flightWith(rec, 1, certificate([toU8(1)], entry)), 47);
  flight(t, rec, "an empty certificate", flightWith(rec, 1, certificate(none, cat([vec24(none), vec16(none)]))), 50);
  flight(t, rec, "a CertificateVerify scheme not offered", flightWith(rec, 2, cv(rec, 0x0401)), 47);
  flight(t, rec, "a CertificateVerify cut short", flightWith(rec, 2, message(15, u16(0x0403))), 50);
  // A ClientHello mid-flight: a message no state takes.
  flight(t, rec, "a ClientHello in the flight", [rec.flight[0], message(1, none)], 10);
  flight(t, rec, "a second EncryptedExtensions", [rec.flight[0], rec.flight[0]], 10);
  flight(t, rec, "a NewSessionTicket before Finished", [rec.flight[0], message(4, none)], 10);

  // The hand-off.
  const waiting: TlsClient = afterHello(config, rec);
  feedAll(waiting, [rec.flight[0], rec.flight[1], rec.flight[2]]);
  t.eqI32("CertificateVerify waits on the caller", waiting.state, TLS_CLIENT_STATE_WAIT_AUTHENTICATION);
  t.eqI32("the scheme is the server's", waiting.scheme, toI32(0x0403));
  t.eqI32("one certificate", toI32(waiting.chain.length), toI32(1));
  t.ok("the leaf as sent", sameBytes(waiting.chain[0], leafCertificate()));
  t.contains("the content opens with 64 spaces", toHex(waiting.signatureContent), "20202020202020202020202020202020");
  t.contains("and the server context string", toHex(waiting.signatureContent), toHex(fromHex("544c5320312e332c207365727665722043657274696669636174655665726966790000")).slice(0, 66));
  t.eqI32("Finished is kept while it waits", feed(waiting, TLS_LEVEL_HANDSHAKE, rec.flight[3]), toI32(0));
  t.eqI32("...and taken when the caller accepts", authenticatePinned(waiting, new PinnedLeaf()), toI32(0));
  t.eqI32("connected", waiting.state, TLS_CLIENT_STATE_CONNECTED);
  t.eqI32("bytes after the handshake", feed(waiting, TLS_LEVEL_HANDSHAKE, rec.flight[3]), toI32(10));

  decide(t, rec, "a chain refused with unknown_ca", 48, true, 48);
  decide(t, rec, "a chain refused with certificate_expired", 45, true, 45);
  decide(t, rec, "a chain refused with an alert out of range", 999, true, 42);
  decide(t, rec, "a chain refused with a negative alert", -1, true, 42);
  decide(t, rec, "a signature that does not verify", 0, false, 51);
  t.eqI32("authenticate before the flight", started(config).authenticate(toI32(0), true), toI32(80));

  const otherName: TlsClient = afterHello({ serverName: "example.com", alpn: h2(), suites: [toI32(0x1301)], deferShare: false }, rec);
  feedAll(otherName, rec.flight);
  const pinned = new PinnedLeaf();
  t.eqI32("the pinned chain for another name", authenticatePinned(otherName, pinned), toI32(48));
  t.eqI32("...is not asked about the signature", pinned.signatureCalls, toI32(0));
  const forged: TlsClient = afterHello(config, rec);
  const badSignature: u8[] = flipped(rec.flight[2], toI32(rec.flight[2].length) - 1);
  feedAll(forged, flightWith(rec, 2, badSignature));
  t.eqI32("a CertificateVerify signature changed", authenticatePinned(forged, new PinnedLeaf()), toI32(51));
  const stale = new PinnedLeaf();
  t.eqI32("the hand-off on a client not waiting", authenticatePinned(started(config), stale), toI32(80));
  t.eqI32("...asks neither verifier", stale.chainCalls + stale.signatureCalls, toI32(0));

  finish(t, rec, "a Finished changed", flipped(rec.flight[3], 4), 51);
  finish(t, rec, "a Finished a byte short", message(20, bytesFrom(rec.flight[3], 5)), 50);
  finish(t, rec, "bytes after Finished", cat([rec.flight[3], message(4, none)]), 10);
  const big: u8[] = [];
  for (let k: i32 = 0; k < 65541; k++) {
    big.push(toU8(0));
  }
  const kept: TlsClient = afterHello(config, rec);
  feedAll(kept, [rec.flight[0], rec.flight[1], rec.flight[2]]);
  t.eqI32("more than 64 KiB kept while it waits", feed(kept, TLS_LEVEL_HANDSHAKE, big), toI32(50));
};

/** All the checks; 0 when every one passed. */
export const clientChecks = (): i32 => {
  const t = new Suite("nish/net/tls-client");
  handshakeCase(t, "AES-128-GCM", [0x1301], noAlpn(), noAlpn(), false);
  handshakeCase(t, "AES-256-GCM", [0x1302], noAlpn(), noAlpn(), false);
  handshakeCase(t, "ChaCha20-Poly1305", [0x1303], noAlpn(), noAlpn(), false);
  handshakeCase(t, "AES-256-GCM first of three", [0x1302, 0x1301, 0x1303], noAlpn(), noAlpn(), false);
  handshakeCase(t, "with ALPN", [0x1301], h2(), h2(), false);
  handshakeCase(t, "ALPN the server does not speak", [0x1301], h2(), noAlpn(), false);
  handshakeCase(t, "a retry for the share", [0x1301], h2(), h2(), true);
  handshakeCase(t, "a retry under SHA-384", [0x1302], noAlpn(), noAlpn(), true);
  configChecks(t);
  serverHelloChecks(t, new Recording([0x1301], noAlpn(), false));
  retryChecks(t);
  flightChecks(t, new Recording([0x1301], h2(), false));
  return t.done();
};
