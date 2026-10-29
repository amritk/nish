// `nish/net/tls/record-client` against `nish/net/tls/record-server` in
// process: a handshake under each suite, application data both ways in
// records of every size, KeyUpdate from either side and on a schedule, both
// ends' close_notify, and every refusal of the client's record layer, each
// built from the live connection's own keys so only the one rule it is about
// is broken. None may panic.
import { Suite } from "nish/testing";
import { Secret, secret, wipe } from "nish:secret";
import { tlsSignEcdsaP256 } from "nish/net/tls";
import {
  TLS_ALERT_DECODE_ERROR,
  TLS_ALERT_HANDSHAKE_FAILURE,
  TLS_ALERT_ILLEGAL_PARAMETER,
  TLS_ALERT_INTERNAL_ERROR,
  TLS_ALERT_UNEXPECTED_MESSAGE,
} from "nish/net/tls/codec";
import {
  TLS_ALERT_BAD_RECORD_MAC,
  TLS_ALERT_RECORD_OVERFLOW,
  TLS_ALERT_USER_CANCELED,
  TLS_CONTENT_ALERT,
  TLS_CONTENT_APPLICATION_DATA,
  TLS_CONTENT_CHANGE_CIPHER_SPEC,
  TLS_CONTENT_HANDSHAKE,
  TlsRecordProtection,
} from "nish/net/tls/record";
import { TLS_RECORD_STATE_OPEN, TlsRecordServer } from "nish/net/tls/record-server";
import {
  TLS_RECORD_CLIENT_AGAIN,
  TLS_RECORD_CLIENT_AUTHENTICATE,
  TLS_RECORD_CLIENT_DATA,
  TLS_RECORD_CLIENT_DONE,
  TLS_RECORD_CLIENT_IDLE_LIMIT,
  TLS_RECORD_CLIENT_INVALID,
  TLS_RECORD_CLIENT_MAX_KEY_UPDATES,
  TLS_RECORD_CLIENT_MAX_TICKET,
  TLS_RECORD_CLIENT_PIPE,
  TLS_RECORD_CLIENT_RESET,
  TLS_RECORD_CLIENT_STATE_CLOSED,
  TLS_RECORD_CLIENT_STATE_FAILED,
  TLS_RECORD_CLIENT_STATE_HANDSHAKE,
  TLS_RECORD_CLIENT_STATE_OPEN,
  TLS_RECORD_CLIENT_WANT_READ,
  TLS_RECORD_CLIENT_WANT_WRITE,
  TlsRecordClient,
  tlsRecordClientAuthenticate,
} from "nish/net/tls/record-client";
import { newServer, leafPrivate, tcpConfig } from "../net_tls_common/server";
import { secretCopy } from "../net_tls_common/secrets";
import { ZERO, ascii, filled, join, keyUpdateMessage, protectionFor, range, sealOne } from "../net_tls_record_common/bytes";
import { splitRecords } from "../net_tls_record_common/client";
import { sameBytes } from "../crypto_x509/hex";
import { PinnedLeaf, UNKNOWN_CA, clientConfig, newClient, pinnedChain, pinnedSignature } from "../net_tls_client/harness";

/** No ALPN. */
const noAlpn = (): string[] => {
  const none: string[] = [];
  return none;
};

/** A client record layer and a server record layer, and the client's authenticator. */
class Pair {
  client: TlsRecordClient;
  server: TlsRecordServer;
  auth: PinnedLeaf;

  constructor(suites: i32[]) {
    this.client = new TlsRecordClient(newClient(clientConfig(suites, noAlpn(), false)));
    this.server = new TlsRecordServer(newServer(tcpConfig(noAlpn())));
    this.auth = new PinnedLeaf();
  }
}

/** Signs what the server waits on with the test leaf, when it waits. */
const signServer = (server: TlsRecordServer): void => {
  const input: u8[] | null = server.signatureInput();
  if (input === null) {
    return;
  }
  const leaf: Secret<u8[]> = secret(leafPrivate());
  const signature: u8[] | null = tlsSignEcdsaP256(leaf, input);
  wipe(leaf);
  if (signature !== null) {
    server.sign(signature);
  }
};

/** What the client has to send, taken out of it. */
const drainClient = (client: TlsRecordClient): u8[] => {
  const out: u8[] = range(client.output, client.outputStart, client.outputEnd);
  client.consume(toI32(out.length));
  return out;
};

/** What the server has to send, taken out of it. */
const drainServer = (server: TlsRecordServer): u8[] => {
  const out: u8[] = range(server.output, server.outputStart, server.outputEnd);
  server.consume(toI32(out.length));
  return out;
};

/** Hands the client every byte of `data` in one call; what it took. */
const feedClient = (client: TlsRecordClient, data: u8[]): i32 => client.receive(data, ZERO, toI32(data.length));

/**
 * Moves bytes between the two ends until neither has anything more to say:
 * the server signs when it waits to, and the client asks the pinned leaf
 * when it waits for the verdict. Each side takes only what it has room for.
 */
const shuttle = (p: Pair): void => {
  for (let round: i32 = 0; round < 256; round++) {
    let moved: boolean = false;
    const up: i32 = p.client.outputEnd - p.client.outputStart;
    if (up > 0) {
      const taken: i32 = p.server.receive(p.client.output, p.client.outputStart, up);
      if (taken > 0) {
        p.client.consume(taken);
        moved = true;
      }
    }
    if (p.server.signatureInput() !== null) {
      signServer(p.server);
      moved = true;
    }
    const down: i32 = p.server.outputEnd - p.server.outputStart;
    if (down > 0) {
      const taken: i32 = p.client.receive(p.server.output, p.server.outputStart, down);
      if (taken > 0) {
        p.server.consume(taken);
        moved = true;
      }
    }
    if ((p.client.interest() & TLS_RECORD_CLIENT_AUTHENTICATE) !== 0) {
      tlsRecordClientAuthenticate(p.client, p.auth, pinnedChain, pinnedSignature);
      moved = true;
    }
    if (!moved) {
      return;
    }
  }
};

/** A pair through its handshake under `suite`. */
const opened = (suite: i32): Pair => {
  const p = new Pair([suite]);
  p.client.start();
  shuttle(p);
  return p;
};

/** Every application byte the client holds, read out. */
const readClient = (client: TlsRecordClient): u8[] => {
  const buf: u8[] = new Array<u8>(1000);
  const out: u8[] = [];
  let n: i32 = client.read(buf, ZERO, toI32(buf.length));
  while (n > 0) {
    for (let k: i32 = 0; k < n; k++) {
      out.push(buf[k]);
    }
    n = client.read(buf, ZERO, toI32(buf.length));
  }
  return out;
};

/** Every application byte the server holds, read out. */
const readServer = (server: TlsRecordServer): u8[] => {
  const buf: u8[] = new Array<u8>(1000);
  const out: u8[] = [];
  let n: i32 = server.read(buf, ZERO, toI32(buf.length));
  while (n > 0) {
    for (let k: i32 = 0; k < n; k++) {
      out.push(buf[k]);
    }
    n = server.read(buf, ZERO, toI32(buf.length));
  }
  return out;
};

/** `n` bytes counting up from `seed`, wrapping at 251, so a moved byte shows. */
const pattern = (n: i32, seed: i32): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < n; k++) {
    out.push(toU8((seed + k) % 251));
  }
  return out;
};

/**
 * Writes all of `data` from the client and reads it at the server, a
 * shuttle between each write so the client never waits on its buffer.
 */
const clientSends = (p: Pair, data: u8[]): u8[] => {
  const got: u8[] = [];
  let at: i32 = 0;
  for (let round: i32 = 0; round < 64 && at < toI32(data.length); round++) {
    const n: i32 = p.client.write(data, at, toI32(data.length) - at);
    if (n > 0) {
      at = at + n;
    }
    shuttle(p);
    for (const b of readServer(p.server)) {
      got.push(b);
    }
  }
  return got;
};

/** The same from the server to the client. */
const serverSends = (p: Pair, data: u8[]): u8[] => {
  const got: u8[] = [];
  let at: i32 = 0;
  for (let round: i32 = 0; round < 64 && at < toI32(data.length); round++) {
    const n: i32 = p.server.write(data, at, toI32(data.length) - at);
    if (n > 0) {
      at = at + n;
    }
    shuttle(p);
    for (const b of readClient(p.client)) {
      got.push(b);
    }
  }
  return got;
};

/** A record the server's live write protection seals, as if it had sent it: `type` around `data`. */
const fromServer = (p: Pair, type: i32, data: u8[]): u8[] => sealOne(p.server.writeProtection, type, data, ZERO);

/** A record in the clear, built by hand, since sealing in the clear refuses some of the types these checks send. */
const clear = (type: i32, data: u8[]): u8[] => {
  const n: i32 = toI32(data.length);
  return join([[toU8(type), toU8(3), toU8(3), toU8((n >> 8) & 255), toU8(n & 255)], data]);
};

/** Whether the client failed with `alert`, with no key left and nothing more to do but send it. */
const failedWith = (t: Suite, label: string, client: TlsRecordClient, alert: i32): void => {
  t.eqI32(`${label}: client failed`, client.state, TLS_RECORD_CLIENT_STATE_FAILED);
  t.eqI32(`${label}: alert`, client.alert, alert);
  t.ok(`${label}: read keys cleared`, !client.readProtection.isProtected());
  t.ok(`${label}: write keys cleared`, !client.writeProtection.isProtected());
};

/** A NewSessionTicket of `body` bytes, every one 7 after the header. */
const ticket = (body: i32): u8[] =>
  join([[toU8(4), toU8((body >> 16) & 255), toU8((body >> 8) & 255), toU8(body & 255)], filled(body, 7)]);

// ---- The handshake and data --------------------------------------------------------

const checkSuite = (t: Suite, label: string, suite: i32): void => {
  const p: Pair = opened(suite);
  t.eqI32(`${label}: client open`, p.client.state, TLS_RECORD_CLIENT_STATE_OPEN);
  t.eqI32(`${label}: server open`, p.server.state, TLS_RECORD_STATE_OPEN);
  t.eqI32(`${label}: suite`, p.client.tls.suite, suite);
  t.eqI32(`${label}: one chain check`, p.auth.chainCalls, toI32(1));
  t.eqI32(`${label}: one signature check`, p.auth.signatureCalls, toI32(1));
  const up: u8[] = pattern(toI32(40000), toI32(3));
  t.ok(`${label}: 40000 bytes reach the server whole`, sameBytes(clientSends(p, up), up));
  const down: u8[] = pattern(toI32(50000), toI32(11));
  t.ok(`${label}: 50000 bytes reach the client whole`, sameBytes(serverSends(p, down), down));
  t.eqI32(`${label}: nothing waits to be read`, p.client.read(new Array<u8>(4), ZERO, toI32(4)), TLS_RECORD_CLIENT_AGAIN);
  const interest: i32 = p.client.interest();
  t.ok(`${label}: wants to read`, (interest & TLS_RECORD_CLIENT_WANT_READ) !== 0);
  t.ok(`${label}: not done`, (interest & TLS_RECORD_CLIENT_DONE) === 0);
};

const checkHandshakeStates = (t: Suite): void => {
  const p = new Pair([0x1301]);
  t.eqI32("before start: write waits", p.client.write(ascii("x"), ZERO, toI32(1)), TLS_RECORD_CLIENT_AGAIN);
  t.eqI32("start", p.client.start(), toI32(0));
  t.ok("start: the ClientHello waits to be sent", (p.client.interest() & TLS_RECORD_CLIENT_WANT_WRITE) !== 0);
  const hello: u8[] = range(p.client.output, p.client.outputStart, p.client.outputEnd);
  t.eqI32("start: the ClientHello goes in the clear", toI32(hello[0]), TLS_CONTENT_HANDSHAKE);
  t.eqI32("start: during the handshake keyUpdate waits", p.client.keyUpdate(false), TLS_RECORD_CLIENT_AGAIN);
  // Up to the verdict: the server's flight in, the client waiting on it.
  const up: u8[] = drainClient(p.client);
  p.server.receive(up, ZERO, toI32(up.length));
  signServer(p.server);
  const flight: u8[] = drainServer(p.server);
  feedClient(p.client, flight);
  t.ok("the client waits for the verdict", (p.client.interest() & TLS_RECORD_CLIENT_AUTHENTICATE) !== 0);
  t.eqI32("waiting: still in the handshake", p.client.state, TLS_RECORD_CLIENT_STATE_HANDSHAKE);
  t.eqI32(
    "the verdict, through the pinned leaf",
    tlsRecordClientAuthenticate(p.client, p.auth, pinnedChain, pinnedSignature),
    toI32(0)
  );
  t.eqI32("after the verdict: open", p.client.state, TLS_RECORD_CLIENT_STATE_OPEN);
  t.eqI32("a second verdict is refused", p.client.authenticate(toI32(0), true), TLS_ALERT_INTERNAL_ERROR);
  shuttle(p);
  t.eqI32("the server reads the Finished", p.server.state, TLS_RECORD_STATE_OPEN);

  // A chain the authenticator refuses: the alert goes to the server, and
  // the signature is never checked.
  const refused = new Pair([0x1301]);
  refused.auth.certificate = filled(toI32(3), toI32(1));
  refused.client.start();
  shuttle(refused);
  failedWith(t, "a refused chain", refused.client, UNKNOWN_CA);
  t.eqI32("a refused chain: no signature check", refused.auth.signatureCalls, toI32(0));
  t.eqI32("a refused chain: the server reads the alert", refused.server.peerAlert, UNKNOWN_CA);
  t.eqI32("a refused chain: authenticate answers its alert", refused.client.authenticate(toI32(0), true), UNKNOWN_CA);

  // A bad signature verdict: decrypt_error.
  const unsigned = new Pair([0x1301]);
  unsigned.client.start();
  const hello2: u8[] = drainClient(unsigned.client);
  unsigned.server.receive(hello2, ZERO, toI32(hello2.length));
  signServer(unsigned.server);
  feedClient(unsigned.client, drainServer(unsigned.server));
  t.eqI32("a bad signature", unsigned.client.authenticate(toI32(0), false), toI32(51));
  failedWith(t, "a bad signature", unsigned.client, toI32(51));
};

const checkRetry = (t: Suite): void => {
  // A client that defers its share takes the HelloRetryRequest path.
  const p = new Pair([0x1301]);
  p.client = new TlsRecordClient(newClient(clientConfig([0x1301], noAlpn(), true)));
  p.client.start();
  shuttle(p);
  t.eqI32("retry: client open", p.client.state, TLS_RECORD_CLIENT_STATE_OPEN);
  t.eqI32("retry: server open", p.server.state, TLS_RECORD_STATE_OPEN);
  const data: u8[] = ascii("after a retry");
  t.ok("retry: data flows", sameBytes(clientSends(p, data), data));
};

// ---- KeyUpdate ----------------------------------------------------------------------

const checkKeyUpdate = (t: Suite): void => {
  const p: Pair = opened(toI32(0x1302));
  t.eqI32("client keyUpdate asking the server", p.client.keyUpdate(true), toI32(0));
  shuttle(p);
  t.eqI32("the server's answer is taken", p.client.keyUpdates, toI32(1));
  const a: u8[] = ascii("after the client's update");
  t.ok("data up after the client's update", sameBytes(clientSends(p, a), a));
  t.ok("data down after the client's update", sameBytes(serverSends(p, a), a));

  t.eqI32("server keyUpdate asking the client", p.server.keyUpdate(true), toI32(0));
  shuttle(p);
  t.eqI32("the client takes the server's update", p.client.keyUpdates, toI32(2));
  t.ok("the client's answer is sent", !p.client.keyUpdateDue);
  const b: u8[] = ascii("after the server's update");
  t.ok("data up after the server's update", sameBytes(clientSends(p, b), b));
  t.ok("data down after the server's update", sameBytes(serverSends(p, b), b));

  // On a schedule: after recordLimit records the client updates by itself.
  p.client.writeProtection.recordLimit = toI64(2);
  const c: u8[] = pattern(toI32(3 * 16384), toI32(5));
  t.ok("data across a scheduled update", sameBytes(clientSends(p, c), c));
  t.ok("the scheduled update reset the sequence", p.client.writeProtection.sequence < toI64(2));

  // A KeyUpdate in the same record as more handshake bytes, or with a bad
  // length or request, and one more than the cap.
  const joined: Pair = opened(toI32(0x1301));
  feedClient(joined.client, fromServer(joined, TLS_CONTENT_HANDSHAKE, join([keyUpdateMessage(toI32(0)), [toU8(4)]])));
  failedWith(t, "a KeyUpdate not ending its record", joined.client, TLS_ALERT_UNEXPECTED_MESSAGE);
  const request: Pair = opened(toI32(0x1301));
  feedClient(request.client, fromServer(request, TLS_CONTENT_HANDSHAKE, keyUpdateMessage(toI32(2))));
  failedWith(t, "a KeyUpdate asking 2", request.client, TLS_ALERT_ILLEGAL_PARAMETER);
  const long: Pair = opened(toI32(0x1301));
  feedClient(
    long.client,
    fromServer(long, TLS_CONTENT_HANDSHAKE, [toU8(24), toU8(0), toU8(0), toU8(2), toU8(0), toU8(0)])
  );
  failedWith(t, "a KeyUpdate of two bytes", long.client, TLS_ALERT_DECODE_ERROR);

  const many: Pair = opened(toI32(0x1301));
  const one: u8[] = ascii("k");
  for (let k: i32 = 0; k < TLS_RECORD_CLIENT_MAX_KEY_UPDATES; k++) {
    many.server.keyUpdate(false);
    many.server.write(one, ZERO, toI32(1));
    shuttle(many);
    readClient(many.client);
  }
  t.eqI32("64 KeyUpdates are taken", many.client.state, TLS_RECORD_CLIENT_STATE_OPEN);
  many.server.keyUpdate(false);
  shuttle(many);
  failedWith(t, "the 65th KeyUpdate", many.client, TLS_ALERT_UNEXPECTED_MESSAGE);
  t.eqI32("the 65th KeyUpdate: the server reads the alert", many.server.peerAlert, TLS_ALERT_UNEXPECTED_MESSAGE);
};

// ---- Post-handshake messages and interleaving -----------------------------------------

const checkPostHandshake = (t: Suite): void => {
  // A NewSessionTicket across three records is dropped, and data after it reads.
  const p: Pair = opened(toI32(0x1303));
  const message: u8[] = ticket(toI32(40));
  feedClient(p.client, fromServer(p, TLS_CONTENT_HANDSHAKE, range(message, ZERO, toI32(2))));
  feedClient(p.client, fromServer(p, TLS_CONTENT_HANDSHAKE, range(message, toI32(2), toI32(20))));
  feedClient(p.client, fromServer(p, TLS_CONTENT_HANDSHAKE, range(message, toI32(20), toI32(message.length))));
  t.eqI32("a ticket in three records is dropped", p.client.state, TLS_RECORD_CLIENT_STATE_OPEN);
  const data: u8[] = ascii("after the ticket");
  t.ok("data after a ticket", sameBytes(serverSends(p, data), data));
  // A ticket and a KeyUpdate in one record.
  const both: Pair = opened(toI32(0x1301));
  feedClient(both.client, fromServer(both, TLS_CONTENT_HANDSHAKE, join([ticket(toI32(20)), keyUpdateMessage(toI32(0))])));
  t.eqI32("a ticket then a KeyUpdate in one record", both.client.keyUpdates, toI32(1));
  t.eqI32("a ticket then a KeyUpdate: still open", both.client.state, TLS_RECORD_CLIENT_STATE_OPEN);
  // The longest ticket the client takes.
  const longest: Pair = opened(toI32(0x1301));
  const big: u8[] = ticket(TLS_RECORD_CLIENT_MAX_TICKET);
  for (let at: i32 = 0; at < toI32(big.length); at = at + 16384) {
    const to: i32 = at + 16384 < toI32(big.length) ? at + 16384 : toI32(big.length);
    feedClient(longest.client, fromServer(longest, TLS_CONTENT_HANDSHAKE, range(big, at, to)));
    // Data between the pieces keeps the idle count down.
    if (longest.client.state === TLS_RECORD_CLIENT_STATE_OPEN && to < toI32(big.length)) {
      continue;
    }
  }
  t.eqI32("the longest ticket is dropped", longest.client.state, TLS_RECORD_CLIENT_STATE_OPEN);

  const short: Pair = opened(toI32(0x1301));
  feedClient(short.client, fromServer(short, TLS_CONTENT_HANDSHAKE, ticket(toI32(13))));
  failedWith(t, "a ticket of 13 bytes", short.client, TLS_ALERT_DECODE_ERROR);
  const over: Pair = opened(toI32(0x1301));
  feedClient(over.client, fromServer(over, TLS_CONTENT_HANDSHAKE, range(ticket(TLS_RECORD_CLIENT_MAX_TICKET + toI32(1)), ZERO, toI32(4))));
  failedWith(t, "a ticket one byte too long", over.client, TLS_ALERT_DECODE_ERROR);
  const request: Pair = opened(toI32(0x1301));
  feedClient(request.client, fromServer(request, TLS_CONTENT_HANDSHAKE, [toU8(13), toU8(0), toU8(0), toU8(0)]));
  failedWith(t, "a CertificateRequest", request.client, TLS_ALERT_UNEXPECTED_MESSAGE);
  const empty: Pair = opened(toI32(0x1301));
  feedClient(empty.client, fromServer(empty, TLS_CONTENT_HANDSHAKE, []));
  failedWith(t, "an empty handshake record", empty.client, TLS_ALERT_UNEXPECTED_MESSAGE);

  // Anything else between the records of one post-handshake message.
  const split: u8[] = range(ticket(toI32(30)), ZERO, toI32(10));
  const data2: Pair = opened(toI32(0x1301));
  feedClient(data2.client, fromServer(data2, TLS_CONTENT_HANDSHAKE, split));
  feedClient(data2.client, fromServer(data2, TLS_CONTENT_APPLICATION_DATA, ascii("x")));
  failedWith(t, "application data inside a ticket", data2.client, TLS_ALERT_UNEXPECTED_MESSAGE);
  const alert2: Pair = opened(toI32(0x1301));
  feedClient(alert2.client, fromServer(alert2, TLS_CONTENT_HANDSHAKE, range(keyUpdateMessage(ZERO), ZERO, toI32(3))));
  feedClient(alert2.client, fromServer(alert2, TLS_CONTENT_ALERT, [toU8(1), toU8(0)]));
  failedWith(t, "an alert inside a KeyUpdate", alert2.client, TLS_ALERT_UNEXPECTED_MESSAGE);

  // Inner types the application level does not take.
  const ccs: Pair = opened(toI32(0x1301));
  feedClient(ccs.client, fromServer(ccs, TLS_CONTENT_CHANGE_CIPHER_SPEC, [toU8(1)]));
  failedWith(t, "a protected change_cipher_spec", ccs.client, TLS_ALERT_UNEXPECTED_MESSAGE);
  const clearCcs: Pair = opened(toI32(0x1301));
  feedClient(clearCcs.client, clear(TLS_CONTENT_CHANGE_CIPHER_SPEC, [toU8(1)]));
  failedWith(t, "a change_cipher_spec after the handshake", clearCcs.client, TLS_ALERT_UNEXPECTED_MESSAGE);
  const unknown: Pair = opened(toI32(0x1301));
  feedClient(unknown.client, fromServer(unknown, toI32(24), ascii("x")));
  failedWith(t, "an inner type nobody defined", unknown.client, TLS_ALERT_UNEXPECTED_MESSAGE);
};

// ---- Records: size, idleness, tampering -------------------------------------------

const checkRecords = (t: Suite): void => {
  const over: Pair = opened(toI32(0x1301));
  feedClient(over.client, [toU8(23), toU8(3), toU8(3), toU8(0x41), toU8(0x01)]);
  failedWith(t, "a record of 2^14 + 257 bytes", over.client, TLS_ALERT_RECORD_OVERFLOW);
  t.ok("record_overflow: the alert waits to be sent", (over.client.interest() & TLS_RECORD_CLIENT_WANT_WRITE) !== 0);
  shuttle(over);
  t.eqI32("record_overflow: the server reads it", over.server.peerAlert, TLS_ALERT_RECORD_OVERFLOW);
  t.ok("record_overflow: done once it is sent", (over.client.interest() & TLS_RECORD_CLIENT_DONE) !== 0);

  const type: Pair = opened(toI32(0x1301));
  feedClient(type.client, [toU8(19), toU8(3), toU8(3), toU8(0), toU8(1), toU8(0)]);
  failedWith(t, "a header of type 19", type.client, TLS_ALERT_UNEXPECTED_MESSAGE);

  const tampered: Pair = opened(toI32(0x1301));
  const record: u8[] = fromServer(tampered, TLS_CONTENT_APPLICATION_DATA, ascii("tamper"));
  record[toI32(record.length) - toI32(1)] = toU8(toI32(record[toI32(record.length) - toI32(1)]) ^ 1);
  feedClient(tampered.client, record);
  failedWith(t, "a tag that does not verify", tampered.client, TLS_ALERT_BAD_RECORD_MAC);
  t.eqI32("after a failure read resets", tampered.client.read(new Array<u8>(4), ZERO, toI32(4)), TLS_RECORD_CLIENT_RESET);
  t.eqI32("after a failure write resets", tampered.client.write(ascii("x"), ZERO, toI32(1)), TLS_RECORD_CLIENT_RESET);
  t.eqI32("after a failure keyUpdate is a pipe", tampered.client.keyUpdate(false), TLS_RECORD_CLIENT_PIPE);
  t.eqI32("after a failure bytes are taken and dropped", feedClient(tampered.client, ascii("abc")), toI32(3));

  // Idle records: empty data, user_canceled; sixteen pass, the seventeenth is refused.
  const idle: Pair = opened(toI32(0x1301));
  for (let k: i32 = 0; k < TLS_RECORD_CLIENT_IDLE_LIMIT; k++) {
    feedClient(idle.client, fromServer(idle, TLS_CONTENT_APPLICATION_DATA, []));
  }
  t.eqI32("sixteen empty records pass", idle.client.state, TLS_RECORD_CLIENT_STATE_OPEN);
  feedClient(idle.client, fromServer(idle, TLS_CONTENT_APPLICATION_DATA, ascii("y")));
  for (let k: i32 = 0; k < TLS_RECORD_CLIENT_IDLE_LIMIT; k++) {
    feedClient(idle.client, fromServer(idle, TLS_CONTENT_ALERT, [toU8(1), toU8(TLS_ALERT_USER_CANCELED)]));
  }
  t.eqI32("data starts the count again", idle.client.state, TLS_RECORD_CLIENT_STATE_OPEN);
  t.ok("the data before them reads", sameBytes(readClient(idle.client), ascii("y")));
  feedClient(idle.client, fromServer(idle, TLS_CONTENT_APPLICATION_DATA, []));
  failedWith(t, "the seventeenth idle record", idle.client, TLS_ALERT_UNEXPECTED_MESSAGE);

  // Windows outside the caller's array.
  const w: Pair = opened(toI32(0x1301));
  const four: u8[] = new Array<u8>(4);
  t.eqI32("receive past the end", w.client.receive(four, toI32(2), toI32(3)), TLS_RECORD_CLIENT_INVALID);
  t.eqI32("receive at a negative offset", w.client.receive(four, toI32(-1), toI32(1)), TLS_RECORD_CLIENT_INVALID);
  t.eqI32("read past the end", w.client.read(four, toI32(1), toI32(4)), TLS_RECORD_CLIENT_INVALID);
  t.eqI32("write of a negative length", w.client.write(four, ZERO, toI32(-1)), TLS_RECORD_CLIENT_INVALID);
  t.eqI32("read of nothing", w.client.read(four, ZERO, ZERO), toI32(0));
  t.eqI32("windows refused, nothing failed", w.client.state, TLS_RECORD_CLIENT_STATE_OPEN);

  // A caller that does not read: the client stops taking records, and a
  // byte at a time drains them.
  const slow: Pair = opened(toI32(0x1301));
  const big: u8[] = pattern(toI32(5 * 16384), toI32(1));
  let sent: i32 = slow.server.write(big, ZERO, toI32(big.length));
  shuttle(slow);
  t.ok("a full buffer stops the client reading", (slow.client.interest() & TLS_RECORD_CLIENT_DATA) !== 0);
  const got: u8[] = [];
  const one: u8[] = new Array<u8>(1);
  for (let round: i32 = 0; round < toI32(10 * 16384) && toI32(got.length) < toI32(big.length); round++) {
    if (slow.client.read(one, ZERO, toI32(1)) === toI32(1)) {
      got.push(one[0]);
    } else {
      if (sent < toI32(big.length)) {
        const n: i32 = slow.server.write(big, sent, toI32(big.length) - sent);
        sent = n > 0 ? sent + n : sent;
      }
      shuttle(slow);
    }
  }
  t.ok("read a byte at a time, it all arrives", sameBytes(got, big));
};

// ---- During the handshake --------------------------------------------------------

/** A pair whose client has read the ServerHello and nothing after it, and the server's flight records. */
class Midway {
  pair: Pair;
  records: u8[][];
  /** What the server writes with during its flight, rebuilt from the client's copy of the secret. */
  serverHandshake: TlsRecordProtection;

  constructor(suite: i32) {
    this.pair = new Pair([suite]);
    this.pair.client.start();
    const hello: u8[] = drainClient(this.pair.client);
    this.pair.server.receive(hello, ZERO, toI32(hello.length));
    signServer(this.pair.server);
    this.records = splitRecords(drainServer(this.pair.server));
    feedClient(this.pair.client, this.records[0]);
    this.serverHandshake = protectionFor(suite, secretCopy(this.pair.client.tls.secrets().serverHandshake));
  }
}

const checkHandshakeRefusals = (t: Suite): void => {
  // In the clear, before the ServerHello.
  const ccs = new Pair([0x1301]);
  ccs.client.start();
  feedClient(ccs.client, clear(TLS_CONTENT_CHANGE_CIPHER_SPEC, [toU8(1)]));
  t.eqI32("a change_cipher_spec before the ServerHello is dropped", ccs.client.state, TLS_RECORD_CLIENT_STATE_HANDSHAKE);
  const ccsTwo = new Pair([0x1301]);
  ccsTwo.client.start();
  feedClient(ccsTwo.client, clear(TLS_CONTENT_CHANGE_CIPHER_SPEC, [toU8(1), toU8(1)]));
  failedWith(t, "a change_cipher_spec of two bytes", ccsTwo.client, TLS_ALERT_UNEXPECTED_MESSAGE);
  const ccsTwoValue = new Pair([0x1301]);
  ccsTwoValue.client.start();
  feedClient(ccsTwoValue.client, clear(TLS_CONTENT_CHANGE_CIPHER_SPEC, [toU8(2)]));
  failedWith(t, "a change_cipher_spec of 2", ccsTwoValue.client, TLS_ALERT_UNEXPECTED_MESSAGE);
  const ccsMany = new Pair([0x1301]);
  ccsMany.client.start();
  for (let k: i32 = 0; k <= TLS_RECORD_CLIENT_IDLE_LIMIT; k++) {
    feedClient(ccsMany.client, clear(TLS_CONTENT_CHANGE_CIPHER_SPEC, [toU8(1)]));
  }
  failedWith(t, "seventeen change_cipher_specs", ccsMany.client, TLS_ALERT_UNEXPECTED_MESSAGE);

  const partial = new Pair([0x1301]);
  partial.client.start();
  feedClient(partial.client, clear(TLS_CONTENT_HANDSHAKE, [toU8(2), toU8(0)]));
  feedClient(partial.client, clear(TLS_CONTENT_CHANGE_CIPHER_SPEC, [toU8(1)]));
  failedWith(t, "a change_cipher_spec inside a message", partial.client, TLS_ALERT_UNEXPECTED_MESSAGE);
  const partialAlert = new Pair([0x1301]);
  partialAlert.client.start();
  feedClient(partialAlert.client, clear(TLS_CONTENT_HANDSHAKE, [toU8(2), toU8(0)]));
  feedClient(partialAlert.client, clear(TLS_CONTENT_ALERT, [toU8(2), toU8(40)]));
  failedWith(t, "an alert inside a message", partialAlert.client, TLS_ALERT_UNEXPECTED_MESSAGE);
  const clearData = new Pair([0x1301]);
  clearData.client.start();
  feedClient(clearData.client, clear(TLS_CONTENT_APPLICATION_DATA, ascii("early")));
  failedWith(t, "application data in the clear", clearData.client, TLS_ALERT_UNEXPECTED_MESSAGE);
  const emptyHello = new Pair([0x1301]);
  emptyHello.client.start();
  feedClient(emptyHello.client, clear(TLS_CONTENT_HANDSHAKE, []));
  failedWith(t, "an empty handshake record", emptyHello.client, TLS_ALERT_UNEXPECTED_MESSAGE);

  // A server that only speaks TLS 1.2 answers a TLS 1.3-only hello with an alert.
  const old = new Pair([0x1301]);
  old.client.start();
  feedClient(old.client, clear(TLS_CONTENT_ALERT, [toU8(2), toU8(TLS_ALERT_HANDSHAKE_FAILURE)]));
  t.eqI32("a server's handshake_failure: failed", old.client.state, TLS_RECORD_CLIENT_STATE_FAILED);
  t.eqI32("a server's handshake_failure: its alert", old.client.peerAlert, TLS_ALERT_HANDSHAKE_FAILURE);
  t.eqI32("a server's handshake_failure: none sent", old.client.alert, toI32(0));
  t.eqI32("a server's handshake_failure: nothing to send", old.client.outputEnd, toI32(0));
  const closing = new Pair([0x1301]);
  closing.client.start();
  drainClient(closing.client);
  feedClient(closing.client, clear(TLS_CONTENT_ALERT, [toU8(1), toU8(0)]));
  t.eqI32("a close_notify during the handshake fails it", closing.client.state, TLS_RECORD_CLIENT_STATE_FAILED);
  t.eqI32(
    "a close_notify during the handshake: read resets",
    closing.client.read(new Array<u8>(4), ZERO, toI32(4)),
    TLS_RECORD_CLIENT_RESET
  );
  const shortAlert = new Pair([0x1301]);
  shortAlert.client.start();
  feedClient(shortAlert.client, clear(TLS_CONTENT_ALERT, [toU8(2)]));
  failedWith(t, "an alert of one byte", shortAlert.client, TLS_ALERT_DECODE_ERROR);

  // Under the server's handshake keys.
  const m = new Midway(toI32(0x1301));
  t.eqI32("midway: the ServerHello is read", m.pair.client.readLevel, toI32(1));
  t.eqI32("midway: the flight is one more record", toI32(m.records.length), toI32(2));
  feedClient(m.pair.client, sealOne(m.serverHandshake, TLS_CONTENT_APPLICATION_DATA, ascii("0.5"), ZERO));
  failedWith(t, "application data under the handshake keys", m.pair.client, TLS_ALERT_UNEXPECTED_MESSAGE);
  shuttle(m.pair);
  t.eqI32("the server opens the alert under the client's handshake keys", m.pair.server.peerAlert, TLS_ALERT_UNEXPECTED_MESSAGE);
  const m2 = new Midway(toI32(0x1302));
  feedClient(m2.pair.client, sealOne(m2.serverHandshake, TLS_CONTENT_CHANGE_CIPHER_SPEC, [toU8(1)], ZERO));
  failedWith(t, "a protected change_cipher_spec in the handshake", m2.pair.client, TLS_ALERT_UNEXPECTED_MESSAGE);
  const m3 = new Midway(toI32(0x1301));
  feedClient(m3.pair.client, clear(TLS_CONTENT_HANDSHAKE, [toU8(8), toU8(0), toU8(0), toU8(0)]));
  failedWith(t, "a handshake record in the clear after the ServerHello", m3.pair.client, TLS_ALERT_UNEXPECTED_MESSAGE);
  const m4 = new Midway(toI32(0x1301));
  feedClient(m4.pair.client, sealOne(m4.serverHandshake, TLS_CONTENT_HANDSHAKE, [toU8(8), toU8(0)], ZERO));
  feedClient(m4.pair.client, sealOne(m4.serverHandshake, TLS_CONTENT_ALERT, [toU8(1), toU8(TLS_ALERT_USER_CANCELED)], ZERO));
  failedWith(t, "a protected alert inside a message", m4.pair.client, TLS_ALERT_UNEXPECTED_MESSAGE);
  const m5 = new Midway(toI32(0x1303));
  feedClient(m5.pair.client, clear(TLS_CONTENT_CHANGE_CIPHER_SPEC, [toU8(1)]));
  t.eqI32("a change_cipher_spec after the ServerHello is dropped", m5.pair.client.state, TLS_RECORD_CLIENT_STATE_HANDSHAKE);
  feedClient(m5.pair.client, m5.records[1]);
  shuttle(m5.pair);
  t.eqI32("and the handshake still completes", m5.pair.client.state, TLS_RECORD_CLIENT_STATE_OPEN);
  // The server's flight with a byte changed: bad_record_mac.
  const m6 = new Midway(toI32(0x1301));
  const flight: u8[] = m6.records[1];
  flight[toI32(10)] = toU8(toI32(flight[toI32(10)]) ^ 0x80);
  feedClient(m6.pair.client, flight);
  failedWith(t, "a flight with a byte changed", m6.pair.client, TLS_ALERT_BAD_RECORD_MAC);
  // Records that arrive while the verdict is awaited wait for it.
  const m7 = new Midway(toI32(0x1301));
  feedClient(m7.pair.client, m7.records[1]);
  feedClient(m7.pair.client, clear(TLS_CONTENT_CHANGE_CIPHER_SPEC, [toU8(1)]));
  t.eqI32("a record during the verdict waits", m7.pair.client.state, TLS_RECORD_CLIENT_STATE_HANDSHAKE);
  tlsRecordClientAuthenticate(m7.pair.client, m7.pair.auth, pinnedChain, pinnedSignature);
  failedWith(t, "and is judged after it", m7.pair.client, TLS_ALERT_UNEXPECTED_MESSAGE);
};

// ---- Closing ----------------------------------------------------------------------

const checkClose = (t: Suite): void => {
  // The client closes first; the server answers and the connection is done.
  const p: Pair = opened(toI32(0x1301));
  p.client.write(ascii("last words"), ZERO, toI32(10));
  p.client.close();
  t.eqI32("close: closed", p.client.state, TLS_RECORD_CLIENT_STATE_CLOSED);
  t.ok("close: the write keys go once close_notify is sealed", !p.client.writeProtection.isProtected());
  t.ok("close: the read keys stay", p.client.readProtection.isProtected());
  t.eqI32("close: write is a pipe", p.client.write(ascii("x"), ZERO, toI32(1)), TLS_RECORD_CLIENT_PIPE);
  t.eqI32("close: keyUpdate is a pipe", p.client.keyUpdate(false), TLS_RECORD_CLIENT_PIPE);
  shuttle(p);
  t.ok("close: the data before it arrives", sameBytes(readServer(p.server), ascii("last words")));
  t.ok("close: the server sees the end", p.server.peerClosed);
  p.server.write(ascii("reply"), ZERO, toI32(5));
  p.server.close();
  shuttle(p);
  t.ok("close: the server's last data arrives", sameBytes(readClient(p.client), ascii("reply")));
  t.eqI32("close: then the end of the stream", p.client.read(new Array<u8>(4), ZERO, toI32(4)), toI32(0));
  t.ok("close: the read keys go at the server's close_notify", !p.client.readProtection.isProtected());
  t.ok("close: done", (p.client.interest() & TLS_RECORD_CLIENT_DONE) !== 0);
  p.client.end();
  t.eqI32("close: the socket's end after both is no failure", p.client.state, TLS_RECORD_CLIENT_STATE_CLOSED);

  // The server closes first; the client may still write.
  const q: Pair = opened(toI32(0x1301));
  q.server.close();
  shuttle(q);
  t.ok("server first: the client sees the end", q.client.peerClosed);
  t.eqI32("server first: read is the end", q.client.read(new Array<u8>(4), ZERO, toI32(4)), toI32(0));
  t.ok("server first: wants no more reading", (q.client.interest() & TLS_RECORD_CLIENT_WANT_READ) === 0);
  t.eqI32("server first: the client still writes", q.client.write(ascii("ok"), ZERO, toI32(2)), toI32(2));
  t.eqI32("server first: bytes after it are taken and dropped", feedClient(q.client, ascii("zz")), toI32(2));
  q.client.close();
  t.ok("server first: done after the client closes", (q.client.interest() & TLS_RECORD_CLIENT_DONE) === 0);
  drainClient(q.client);
  t.ok("server first: done once it is sent", (q.client.interest() & TLS_RECORD_CLIENT_DONE) !== 0);

  // Truncation: the socket ends without close_notify. Data already opened still reads.
  const cut: Pair = opened(toI32(0x1301));
  cut.server.write(ascii("partial"), ZERO, toI32(7));
  feedClient(cut.client, drainServer(cut.server));
  cut.client.end();
  t.eqI32("truncation: failed", cut.client.state, TLS_RECORD_CLIENT_STATE_FAILED);
  t.ok("truncation: keys wiped", !cut.client.readProtection.isProtected() && !cut.client.writeProtection.isProtected());
  t.ok("truncation: nothing sent", cut.client.outputEnd === toI32(0));
  t.ok("truncation: what was opened still reads", sameBytes(readClient(cut.client), ascii("partial")));
  t.eqI32("truncation: then a reset", cut.client.read(new Array<u8>(4), ZERO, toI32(4)), TLS_RECORD_CLIENT_RESET);
  // Cut inside a record.
  const mid: Pair = opened(toI32(0x1301));
  mid.server.write(ascii("cut"), ZERO, toI32(3));
  const half: u8[] = drainServer(mid.server);
  feedClient(mid.client, range(half, ZERO, toI32(6)));
  mid.client.end();
  t.eqI32("truncation inside a record: failed", mid.client.state, TLS_RECORD_CLIENT_STATE_FAILED);
  // During the handshake.
  const early = new Pair([0x1301]);
  early.client.start();
  early.client.end();
  t.eqI32("truncation in the handshake: failed", early.client.state, TLS_RECORD_CLIENT_STATE_FAILED);

  // A close during the handshake ends it.
  const giveUp = new Pair([0x1301]);
  giveUp.client.start();
  drainClient(giveUp.client);
  giveUp.client.close();
  t.eqI32("close in the handshake: failed", giveUp.client.state, TLS_RECORD_CLIENT_STATE_FAILED);
  t.ok("close in the handshake: the close_notify waits", giveUp.client.outputEnd > toI32(0));

  // abort: nothing more sent, everything wiped.
  const gone: Pair = opened(toI32(0x1301));
  gone.client.write(ascii("never"), ZERO, toI32(5));
  gone.client.abort();
  t.eqI32("abort: failed", gone.client.state, TLS_RECORD_CLIENT_STATE_FAILED);
  t.eqI32("abort: nothing to send", gone.client.outputEnd, toI32(0));
  t.ok("abort: keys wiped", !gone.client.readProtection.isProtected() && !gone.client.writeProtection.isProtected());
  t.ok("abort: done", (gone.client.interest() & TLS_RECORD_CLIENT_DONE) !== 0);

  // The server's fatal alert, under its application keys.
  const fatal: Pair = opened(toI32(0x1301));
  feedClient(fatal.client, fromServer(fatal, TLS_CONTENT_ALERT, [toU8(2), toU8(80)]));
  t.eqI32("a server's internal_error: failed", fatal.client.state, TLS_RECORD_CLIENT_STATE_FAILED);
  t.eqI32("a server's internal_error: its alert", fatal.client.peerAlert, toI32(80));
  t.eqI32("a server's internal_error: none sent", fatal.client.outputEnd, toI32(0));
  const three: Pair = opened(toI32(0x1301));
  feedClient(three.client, fromServer(three, TLS_CONTENT_ALERT, [toU8(1), toU8(0), toU8(0)]));
  failedWith(t, "an alert of three bytes", three.client, TLS_ALERT_DECODE_ERROR);
};

export const recordClientChecks = (): i32 => {
  const t = new Suite("nish/net/tls/record-client");
  checkSuite(t, "AES-128-GCM", toI32(0x1301));
  checkSuite(t, "AES-256-GCM", toI32(0x1302));
  checkSuite(t, "ChaCha20-Poly1305", toI32(0x1303));
  checkHandshakeStates(t);
  checkRetry(t);
  checkKeyUpdate(t);
  checkPostHandshake(t);
  checkRecords(t);
  checkHandshakeRefusals(t);
  checkClose(t);
  return t.done();
};
