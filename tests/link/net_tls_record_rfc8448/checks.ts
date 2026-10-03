// `nish/net/tls/record` and `nish/net/tls/record-server` against RFC 8448 §3,
// byte for byte, and against an independent model for what the trace leaves
// out. Four parts:
//
//   1. Every record the trace prints, sealed by `TlsRecordProtection` under
//      the trace's keys at the trace's sequence numbers, and opened back.
//   2. The client's stream cut at every byte, and at seeded random points,
//      through `TlsRecordReader`: the same four records come out every time.
//   3. `TlsRecordServer` replaying the server's side: the trace's ClientHello
//      record in, the trace's ServerHello record and its one 679-byte flight
//      record out, the client's Finished, data and `close_notify` records in.
//      Then the same replay with the client's stream cut at every byte.
//   4. The two suites RFC 8448 does not use, padding, and KeyUpdate's next
//      secret, against Python's `cryptography` and `hmac` (the script is in
//      the pull request that added this file).
import { Suite } from "nish/testing";
import { TLS_AES_128_GCM_SHA256, TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256 } from "nish/net/tls/schedule";
import { TlsServer } from "nish/net/tls";
import {
  TLS_ALERT_CLOSE_NOTIFY,
  TLS_CONTENT_ALERT,
  TLS_CONTENT_APPLICATION_DATA,
  TLS_CONTENT_HANDSHAKE,
  TlsRecordProtection,
  TlsRecordReader,
  tlsNextTrafficSecret,
} from "nish/net/tls/record";
import {
  TLS_RECORD_DATA,
  TLS_RECORD_DONE,
  TLS_RECORD_SIGN,
  TLS_RECORD_STATE_CLOSED,
  TLS_RECORD_STATE_HANDSHAKE,
  TLS_RECORD_STATE_OPEN,
  TLS_RECORD_WANT_WRITE,
  TlsRecordServer,
} from "nish/net/tls/record-server";
import { fromHex, toHex } from "../crypto_x509/hex";
import { rfc8448Config } from "../net_tls_rfc8448/checks";
import {
  rfc8448ClientApplicationTraffic,
  rfc8448ClientFinished,
  rfc8448ClientHandshakeTraffic,
  rfc8448ClientHello,
  rfc8448RsaPssSignature,
  rfc8448ServerApplicationIv,
  rfc8448ServerApplicationKey,
  rfc8448ServerApplicationTraffic,
  rfc8448ServerHandshakeIv,
  rfc8448ServerHandshakeKey,
  rfc8448ServerHandshakeTraffic,
  rfc8448ServerHello,
  rfc8448ServerPrivate,
  rfc8448ServerRandom,
} from "../net_tls_rfc8448/trace";
import {
  Opened,
  Splitter,
  ZERO,
  allZero,
  ascii,
  drain,
  feed,
  join,
  openOne,
  protectionFor,
  range,
  readAll,
  sealOne,
} from "../net_tls_record_common/bytes";
import {
  rfc8448ApplicationPayload,
  rfc8448ClientAlertRecord,
  rfc8448ClientApplicationRecord,
  rfc8448ClientFinishedRecord,
  rfc8448ClientHelloRecord,
  rfc8448NewSessionTicket,
  rfc8448NewSessionTicketRecord,
  rfc8448ServerAlertRecord,
  rfc8448ServerApplicationRecord,
  rfc8448ServerFlightPayload,
  rfc8448ServerFlightRecord,
  rfc8448ServerHelloRecord,
} from "./records";

/** `close_notify` as an alert's two bytes. */
const closeNotify = (): u8[] => [toU8(1), toU8(TLS_ALERT_CLOSE_NOTIFY)];

/** The client's whole stream in §3: ClientHello, Finished, its data and its `close_notify`. */
export const rfc8448ClientStream = (): u8[] =>
  join([
    rfc8448ClientHelloRecord(),
    rfc8448ClientFinishedRecord(),
    rfc8448ClientApplicationRecord(),
    rfc8448ClientAlertRecord(),
  ]);

/** The records of `stream` as a reader sees them when it arrives in pieces `cut` decides, joined with `|` between. */
const recordsThroughReader = (stream: u8[], cuts: i32[]): string => {
  const reader = new TlsRecordReader();
  const seen: string[] = [""];
  let at: i32 = 0;
  const length: i32 = toI32(stream.length);
  let piece: i32 = 0;
  while (at < length) {
    const size: i32 = piece < toI32(cuts.length) ? cuts[piece] : length - at;
    piece = piece + 1;
    const end: i32 = at + size < length ? at + size : length;
    let off: i32 = at;
    while (off < end) {
      const took: i32 = reader.push(stream, off, end - off);
      if (took < 0) {
        return "refused";
      }
      off = off + took;
      let n: i32 = reader.next();
      while (n > 0) {
        seen.push(toHex(range(reader.buffer, reader.start, reader.start + n)));
        reader.consume(n);
        n = reader.next();
      }
      if (n < 0) {
        return `alert ${-n}`;
      }
    }
    at = end;
  }
  return seen.join("|");
};

/** The server RFC 8448 §3 runs, with the trace's randomness, and `key` as the array it is handed. */
const traceServer = (key: u8[]): TlsServer => new TlsServer(rfc8448Config(), rfc8448ServerRandom(), key);

/** What a replay of the client's stream did, for comparing one cut with another. */
class Replay {
  sent: u8[];
  received: u8[];
  state: i32 = 0;
  peerClosed: boolean = false;
  alert: i32 = 0;

  constructor() {
    this.sent = [];
    this.received = [];
  }
}

/** Feeds `stream` to a fresh trace server in the pieces `cuts` gives, signing when it asks, and records what happened. */
const replay = (stream: u8[], cuts: i32[]): Replay => {
  const conn = new TlsRecordServer(traceServer(rfc8448ServerPrivate()));
  const result = new Replay();
  let at: i32 = 0;
  let piece: i32 = 0;
  const length: i32 = toI32(stream.length);
  while (at < length) {
    const size: i32 = piece < toI32(cuts.length) ? cuts[piece] : length - at;
    piece = piece + 1;
    const end: i32 = at + size < length ? at + size : length;
    conn.receive(stream, at, end - at);
    if ((conn.interest() & TLS_RECORD_SIGN) !== 0) {
      conn.sign(rfc8448RsaPssSignature());
    }
    for (const b of drain(conn)) {
      result.sent.push(b);
    }
    at = end;
  }
  result.received = readAll(conn);
  result.state = conn.state;
  result.peerClosed = conn.peerClosed;
  result.alert = conn.alert;
  return result;
};

/** A replay's outcome as one line, for comparing cuts. */
const replaySummary = (r: Replay): string =>
  `sent ${toHex(r.sent)} received ${toHex(r.received)} state ${r.state} closed ${r.peerClosed} alert ${r.alert}`;

/** The opened record as one line: type and content, or the alert. */
const shown = (o: Opened): string => (o.alert !== 0 ? `alert ${o.alert}` : `type ${o.type} ${toHex(o.content)}`);

/**
 * Runs every check and answers the exit code. A function of its own so that
 * `tests/link/net_tls_record_f64` runs the same checks under
 * `--number-mode f64`.
 */
export const rfc8448RecordChecks = (): i32 => {
  const t = new Suite("tls records rfc8448");
  const suite: i32 = TLS_AES_128_GCM_SHA256;

  // --- 1. Every record of the trace ------------------------------------------
  const clear = new TlsRecordProtection();
  t.eqStr(
    "{server} the ServerHello record, in the clear",
    toHex(sealOne(clear, TLS_CONTENT_HANDSHAKE, rfc8448ServerHello(), ZERO)),
    toHex(rfc8448ServerHelloRecord())
  );
  t.eqStr(
    "{server} the client's ClientHello record opens to the ClientHello, whatever its legacy version says",
    shown(openOne(clear, rfc8448ClientHelloRecord())),
    `type 22 ${toHex(rfc8448ClientHello())}`
  );

  const serverHandshake = protectionFor(suite, rfc8448ServerHandshakeTraffic());
  t.eqStr("server handshake write key", toHex(serverHandshake.key), toHex(rfc8448ServerHandshakeKey()));
  t.eqStr("server handshake write iv", toHex(serverHandshake.iv), toHex(rfc8448ServerHandshakeIv()));
  t.eqStr(
    "{server} the flight record: EncryptedExtensions through Finished, one record, sequence 0",
    toHex(sealOne(serverHandshake, TLS_CONTENT_HANDSHAKE, rfc8448ServerFlightPayload(), ZERO)),
    toHex(rfc8448ServerFlightRecord())
  );
  const clientReadsHandshake = protectionFor(suite, rfc8448ServerHandshakeTraffic());
  t.eqStr(
    "{client} the flight record opens to the flight",
    shown(openOne(clientReadsHandshake, rfc8448ServerFlightRecord())),
    `type 22 ${toHex(rfc8448ServerFlightPayload())}`
  );

  const clientHandshake = protectionFor(suite, rfc8448ClientHandshakeTraffic());
  t.eqStr(
    "{client} the Finished record, sequence 0",
    toHex(sealOne(clientHandshake, TLS_CONTENT_HANDSHAKE, rfc8448ClientFinished(), ZERO)),
    toHex(rfc8448ClientFinishedRecord())
  );
  const serverReadsHandshake = protectionFor(suite, rfc8448ClientHandshakeTraffic());
  t.eqStr(
    "{server} the client's Finished record opens to its Finished",
    shown(openOne(serverReadsHandshake, rfc8448ClientFinishedRecord())),
    `type 22 ${toHex(rfc8448ClientFinished())}`
  );

  const serverApplication = protectionFor(suite, rfc8448ServerApplicationTraffic());
  t.eqStr("server application write key", toHex(serverApplication.key), toHex(rfc8448ServerApplicationKey()));
  t.eqStr("server application write iv", toHex(serverApplication.iv), toHex(rfc8448ServerApplicationIv()));
  t.eqStr(
    "{server} the NewSessionTicket record, sequence 0",
    toHex(sealOne(serverApplication, TLS_CONTENT_HANDSHAKE, rfc8448NewSessionTicket(), ZERO)),
    toHex(rfc8448NewSessionTicketRecord())
  );
  t.eqStr(
    "{server} the application data record, sequence 1",
    toHex(sealOne(serverApplication, TLS_CONTENT_APPLICATION_DATA, rfc8448ApplicationPayload(), ZERO)),
    toHex(rfc8448ServerApplicationRecord())
  );
  t.eqStr(
    "{server} the close_notify record, sequence 2",
    toHex(sealOne(serverApplication, TLS_CONTENT_ALERT, closeNotify(), ZERO)),
    toHex(rfc8448ServerAlertRecord())
  );

  const clientApplication = protectionFor(suite, rfc8448ClientApplicationTraffic());
  t.eqStr(
    "{client} the application data record, sequence 0",
    toHex(sealOne(clientApplication, TLS_CONTENT_APPLICATION_DATA, rfc8448ApplicationPayload(), ZERO)),
    toHex(rfc8448ClientApplicationRecord())
  );
  t.eqStr(
    "{client} the close_notify record, sequence 1",
    toHex(sealOne(clientApplication, TLS_CONTENT_ALERT, closeNotify(), ZERO)),
    toHex(rfc8448ClientAlertRecord())
  );
  const serverReadsApplication = protectionFor(suite, rfc8448ClientApplicationTraffic());
  t.eqStr(
    "{server} the client's data record opens to the fifty bytes",
    shown(openOne(serverReadsApplication, rfc8448ClientApplicationRecord())),
    `type 23 ${toHex(rfc8448ApplicationPayload())}`
  );
  t.eqStr(
    "{server} the client's close_notify record opens to the alert",
    shown(openOne(serverReadsApplication, rfc8448ClientAlertRecord())),
    "type 21 0100"
  );
  t.ok("the sequence number counts each record opened", serverReadsApplication.sequence === toI64(2));

  // --- 2. The client's stream at every cut -----------------------------------
  const stream: u8[] = rfc8448ClientStream();
  const length: i32 = toI32(stream.length);
  const whole: string = recordsThroughReader(stream, []);
  t.eqStr(
    "the reader finds the client's four records in its stream",
    whole,
    `|${toHex(rfc8448ClientHelloRecord())}|${toHex(rfc8448ClientFinishedRecord())}|${toHex(
      rfc8448ClientApplicationRecord()
    )}|${toHex(rfc8448ClientAlertRecord())}`
  );
  let sameAtEveryCut: boolean = true;
  for (let cut: i32 = 1; cut < length; cut++) {
    const cuts: i32[] = [cut];
    if (recordsThroughReader(stream, cuts) !== whole) {
      sameAtEveryCut = false;
    }
  }
  t.ok(`the same four records with the stream cut in two at each of its ${length - 1} inner points`, sameAtEveryCut);
  const bytewise: i32[] = [];
  for (let k: i32 = 0; k < length; k++) {
    bytewise.push(1);
  }
  t.eqStr("the same four records with the stream fed a byte at a time", recordsThroughReader(stream, bytewise), whole);
  const random = new Splitter(toU32(0x8448));
  let sameAtRandomCuts: boolean = true;
  for (let round: i32 = 0; round < 64; round++) {
    const cuts: i32[] = [];
    let covered: i32 = 0;
    while (covered < length) {
      const size: i32 = random.next(toI32(40));
      cuts.push(size);
      covered = covered + size;
    }
    if (recordsThroughReader(stream, cuts) !== whole) {
      sameAtRandomCuts = false;
    }
  }
  t.ok("the same four records under 64 seeded random cuttings, pieces of 1 to 40 bytes", sameAtRandomCuts);

  // --- 3. The server's side, replayed through TlsRecordServer ----------------
  const key: u8[] = rfc8448ServerPrivate();
  const conn = new TlsRecordServer(traceServer(key));
  const tls: TlsServer = conn.tls;
  t.eqI32("the ClientHello record is taken whole", feed(conn, rfc8448ClientHelloRecord()), toI32(rfc8448ClientHelloRecord().length));
  t.ok("the server asks for its signature, with the ServerHello to send", conn.interest() === (TLS_RECORD_SIGN | TLS_RECORD_WANT_WRITE | 1));
  t.eqStr("it writes the trace's ServerHello record, and nothing else yet", toHex(drain(conn)), toHex(rfc8448ServerHelloRecord()));
  t.ok("the ephemeral key it was handed is wiped once the ServerHello is written", toI32(key.length) === 32 && allZero(key));
  t.eqI32("the trace's signature is taken", conn.sign(rfc8448RsaPssSignature()), ZERO);
  t.eqStr("its flight is the trace's one 679-byte record", toHex(drain(conn)), toHex(rfc8448ServerFlightRecord()));
  t.eqI32("still in the handshake until the client's Finished", conn.state, TLS_RECORD_STATE_HANDSHAKE);
  t.ok(
    "the handshake and server secrets are wiped in TlsServer once installed here",
    allZero(tls.handshakeSecret) &&
      allZero(tls.clientHandshakeSecret) &&
      allZero(tls.serverHandshakeSecret) &&
      allZero(tls.serverApplicationSecret)
  );
  t.eqStr("and the server's application secret lives on here", toHex(conn.writeSecret), toHex(rfc8448ServerApplicationTraffic()));
  feed(conn, join([rfc8448ClientFinishedRecord(), rfc8448ClientApplicationRecord()]));
  t.eqI32("the client's Finished opens the connection", conn.state, TLS_RECORD_STATE_OPEN);
  t.ok(
    "its application secret is kept here and wiped in TlsServer",
    toHex(conn.readSecret) === toHex(rfc8448ClientApplicationTraffic()) && allZero(tls.clientApplicationSecret)
  );
  t.ok("the client's data is waiting to be read", (conn.interest() & TLS_RECORD_DATA) !== 0);
  t.eqStr("it reads as the fifty bytes", toHex(readAll(conn)), toHex(rfc8448ApplicationPayload()));
  const payload: u8[] = rfc8448ApplicationPayload();
  t.eqI32("writing them back takes all fifty", conn.write(payload, ZERO, toI32(payload.length)), toI32(50));
  const echoed: u8[] = drain(conn);
  const clientReadsApplication = protectionFor(suite, rfc8448ServerApplicationTraffic());
  t.eqStr(
    "{client} the echo is one record under the server's application keys, sequence 0 (no NewSessionTicket went first)",
    shown(openOne(clientReadsApplication, echoed)),
    `type 23 ${toHex(payload)}`
  );
  feed(conn, rfc8448ClientAlertRecord());
  t.ok("the client's close_notify ends its stream", conn.peerClosed && (conn.interest() & TLS_RECORD_DATA) !== 0);
  const end: u8[] = new Array<u8>(8);
  t.eqI32("a read at the end of the stream answers 0", conn.read(end, ZERO, toI32(end.length)), ZERO);
  conn.close();
  t.eqI32("closing writes the server's close_notify", conn.state, TLS_RECORD_STATE_CLOSED);
  t.eqStr("{client} which opens at sequence 1", shown(openOne(clientReadsApplication, drain(conn))), "type 21 0100");
  t.ok("and then there is nothing more to do", conn.interest() === TLS_RECORD_DONE);

  // The same replay at every cut of the client's stream, a byte at a time,
  // and under random cuttings: what the server sends, what it reads and where
  // it ends up never depend on how the bytes arrived.
  const reference: string = replaySummary(replay(stream, []));
  t.ok(
    "the replay fed whole sends the ServerHello and flight records and reads the fifty bytes",
    reference ===
      `sent ${toHex(join([rfc8448ServerHelloRecord(), rfc8448ServerFlightRecord()]))} received ${toHex(
        payload
      )} state 1 closed true alert 0`
  );
  let replayAtEveryCut: boolean = true;
  for (let cut: i32 = 1; cut < length; cut++) {
    const cuts: i32[] = [cut];
    if (replaySummary(replay(stream, cuts)) !== reference) {
      replayAtEveryCut = false;
    }
  }
  t.ok(`the same replay with the stream cut in two at each of its ${length - 1} inner points`, replayAtEveryCut);
  t.eqStr("the same replay with the stream fed a byte at a time", replaySummary(replay(stream, bytewise)), reference);
  let replayAtRandomCuts: boolean = true;
  for (let round: i32 = 0; round < 16; round++) {
    const cuts: i32[] = [];
    let covered: i32 = 0;
    while (covered < length) {
      const size: i32 = random.next(toI32(60));
      cuts.push(size);
      covered = covered + size;
    }
    if (replaySummary(replay(stream, cuts)) !== reference) {
      replayAtRandomCuts = false;
    }
  }
  t.ok("the same replay under 16 seeded random cuttings, pieces of 1 to 60 bytes", replayAtRandomCuts);

  // --- 4. What RFC 8448 does not cover, against an independent model ---------
  const s256: u8[] = rfc8448ClientApplicationTraffic();
  t.eqStr(
    "KeyUpdate's next secret over SHA-256, from the trace's client_application_traffic_secret_0",
    toHex(tlsNextTrafficSecret(32, s256)),
    "fcdfcc72725aaee48bf64e4fd8b749cdbdbab39d90da0b26e2245ca6ea167207"
  );
  const s384: u8[] = [];
  for (let k: i32 = 0x40; k < 0x70; k++) {
    s384.push(toU8(k));
  }
  t.eqStr(
    "KeyUpdate's next secret over SHA-384",
    toHex(tlsNextTrafficSecret(48, s384)),
    "3255a7cd505c9e8030cd35c53a234e9d4a0fbe907003b132feea8e7eb3fafab00aa859605fcdc4d1f4e7f49d221fabad"
  );
  const chacha = protectionFor(TLS_CHACHA20_POLY1305_SHA256, s256);
  t.eqStr(
    "ChaCha20-Poly1305: application data with seven bytes of padding, sequence 0",
    toHex(sealOne(chacha, TLS_CONTENT_APPLICATION_DATA, ascii("hello, chacha"), 7)),
    "170303002577b42601fc3ad6048a83a929c0c3d1054459a709725ddc45e5e9c692e370231691777db2df"
  );
  const none: u8[] = [];
  t.eqStr(
    "ChaCha20-Poly1305: empty application data, sequence 1",
    toHex(sealOne(chacha, TLS_CONTENT_APPLICATION_DATA, none, ZERO)),
    "1703030011419dd862348b2168fd392550d32db2084f"
  );
  const keyUpdate: u8[] = [toU8(24), toU8(0), toU8(0), toU8(1), toU8(1)];
  t.eqStr(
    "ChaCha20-Poly1305: a KeyUpdate asking for one back, sequence 2",
    toHex(sealOne(chacha, TLS_CONTENT_HANDSHAKE, keyUpdate, ZERO)),
    "17030300169de9b3c40ff0270024b1c529c1d6131c27031a782ff9"
  );
  const chachaReader = protectionFor(TLS_CHACHA20_POLY1305_SHA256, s256);
  t.eqStr(
    "ChaCha20-Poly1305: the padded record opens with its padding gone",
    shown(openOne(chachaReader, fromHex("170303002577b42601fc3ad6048a83a929c0c3d1054459a709725ddc45e5e9c692e370231691777db2df"))),
    `type 23 ${toHex(ascii("hello, chacha"))}`
  );
  t.eqStr(
    "ChaCha20-Poly1305: and the empty one to nothing",
    shown(openOne(chachaReader, fromHex("1703030011419dd862348b2168fd392550d32db2084f"))),
    "type 23 "
  );
  const aes256 = protectionFor(TLS_AES_256_GCM_SHA384, s384);
  t.eqStr(
    "AES-256-GCM-SHA384: application data, sequence 0",
    toHex(sealOne(aes256, TLS_CONTENT_APPLICATION_DATA, ascii("hello, sha384"), ZERO)),
    "170303001eefbf72bc4519a9800541a51353972c755afb4b77958282d3cc81c3e03a2a"
  );
  t.eqStr(
    "AES-256-GCM-SHA384: close_notify with three bytes of padding, sequence 1",
    toHex(sealOne(aes256, TLS_CONTENT_ALERT, closeNotify(), 3)),
    "17030300161b4c407bc3dffa1ec318795fbc8e899d035e8608b71c"
  );
  const aes256Reader = protectionFor(TLS_AES_256_GCM_SHA384, s384);
  openOne(aes256Reader, fromHex("170303001eefbf72bc4519a9800541a51353972c755afb4b77958282d3cc81c3e03a2a"));
  t.eqStr(
    "AES-256-GCM-SHA384: the padded alert opens at sequence 1",
    shown(openOne(aes256Reader, fromHex("17030300161b4c407bc3dffa1ec318795fbc8e899d035e8608b71c"))),
    "type 21 0100"
  );
  const padded = protectionFor(suite, rfc8448ServerApplicationTraffic());
  padded.sequence = toI64(3);
  t.eqStr(
    "AES-128-GCM: thirteen bytes of padding at sequence 3, under the trace's server application keys",
    toHex(sealOne(padded, TLS_CONTENT_APPLICATION_DATA, ascii("padded"), 13)),
    "17030300246110681fecfcb25bc2a7c1a39fb2e04aacd146a14490efea0e902a88db1bb668c6cb275a"
  );

  return t.done();
};
