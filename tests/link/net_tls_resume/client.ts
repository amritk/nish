// The client's half of the resumption tests: a ClientHello offering tickets
// in any shape the table in docs/security/tls.md ("Resumption") names, its
// binders computed as a client would, the secrets of a full or a resumed
// handshake worked out from what the server sent, the NewSessionTicket read
// back into a ticket and its PSK, and a driver that runs one handshake through
// a `TlsRecordServer`, lending it the ticket keys and the strike register.
import { tlsSignEcdsaP256 } from "nish/net/tls";
import {
  TLS_GROUP_X25519,
  TLS_LEGACY_VERSION,
  TLS_SIGNATURE_ECDSA_SECP256R1_SHA256,
  TLS_SIGNATURE_RSA_PSS_RSAE_SHA256,
  TLS_VERSION_13,
  TlsClientHelloView,
  tlsReadClientHello,
  tlsSelectPskIdentity,
} from "nish/net/tls/codec";
import {
  TLS_AES_128_GCM_SHA256,
  tlsBinderKey,
  tlsDeriveSecret,
  tlsEarlySecret,
  tlsFinishedVerifyData,
  tlsHandshakeSecret,
  tlsMasterSecret,
  tlsPskEarlySecret,
  tlsResumptionPsk,
} from "nish/net/tls/schedule";
import { TLS_CONTENT_HANDSHAKE } from "nish/net/tls/record";
import {
  TLS_RECORD_SIGN,
  TLS_RECORD_STATE_OPEN,
  TLS_RECORD_TICKET,
  TlsRecordServer,
} from "nish/net/tls/record-server";
import {
  TlsTicketKeyInfo,
  TlsTicketState,
  TlsTicketStrikes,
  tlsTicketKeyDraw,
  tlsTicketSeal,
  tlsTicketSize,
} from "nish/net/tls/ticket";
import { Secret, secret, wipe } from "nish:secret";
import { copyOf, x25519Plain } from "../crypto_x25519/plain";
import { sameBytes } from "../crypto_x509/hex";
import { secretCopy } from "../net_tls_common/secrets";
import {
  GROUP_SECP256R1,
  cat,
  clientHelloRaw,
  clientPrivate,
  clientShare,
  extKeyShare,
  extServerName,
  extSignatureAlgorithms,
  extSupportedGroups,
  extSupportedVersions,
  extension,
  splitMessages,
  transcriptHash,
  vec16,
  vec8,
} from "../net_tls_common/client";
import { leafPrivate } from "../net_tls_common/server";
import { clearRecord, splitRecords } from "../net_tls_record_common/client";
import { ZERO, drain, feed, filled, join, openOne, protectionFor, range, sealOne } from "../net_tls_record_common/bytes";

/** The suite every case negotiates, and its hash length. */
export const SUITE: i32 = TLS_AES_128_GCM_SHA256;
export const H: i32 = 32;

export const SECOND: i64 = 1000000000;
export const MINUTE: i64 = SECOND * 60;
export const HOUR: i64 = MINUTE * 60;
/** When the ticket keys are drawn, and the clock most cases run at. */
export const START: i64 = HOUR * 100;

/** `pre_shared_key`'s and `psk_key_exchange_modes`' extension numbers. */
const EXT_PSK: i32 = 41;
const EXT_PSK_MODES: i32 = 45;
const EXT_EARLY_DATA: i32 = 42;
const EXT_KEY_SHARE: i32 = 51;

/** What a ClientHello offers: every field a row of the table moves. */
export class Offer {
  /** Whether `signature_algorithms` is sent, and the schemes it lists. */
  sigalgs: boolean = true;
  schemes: i32[];
  /** Only a secp256r1 share, so the server asks again. */
  retry: boolean = false;
  /** The `server_name` sent; empty for none. */
  name: string = "";
  earlyData: boolean = false;
  hasModes: boolean = true;
  modes: u8[];
  /** The tickets offered, one identity each. */
  tickets: u8[][];
  /** Send `pre_shared_key` even when `tickets` is empty. */
  pskAlways: boolean = false;
  /** Each binder's length; `H` for any left out. */
  binderLengths: i32[];
  /** Binders sent beyond (or short of) one per identity. */
  binderCountDelta: i32 = 0;
  /** `pre_shared_key` last, as §4.2.11 requires; when false, an extension follows it. */
  pskLast: boolean = true;
  /** An all-zero x25519 share, a low-order point. */
  lowOrder: boolean = false;
  /** The PSK the binder of identity `bindIndex` is computed under; empty leaves every binder zero. */
  psk: u8[];
  bindIndex: i32 = 0;
  /** Bind the second ClientHello alone, as if no HelloRetryRequest came before it. */
  bindAlone: boolean = false;

  constructor() {
    this.schemes = [TLS_SIGNATURE_ECDSA_SECP256R1_SHA256, TLS_SIGNATURE_RSA_PSS_RSAE_SHA256];
    this.modes = [toU8(1)];
    this.tickets = [];
    this.binderLengths = [];
    this.psk = [];
  }
}

/** An offer of `ticket`, bound under `psk`. */
export const offerOf = (ticket: u8[], psk: u8[]): Offer => {
  const offer = new Offer();
  offer.tickets.push(ticket);
  offer.psk = psk;
  return offer;
};

/** The `pre_shared_key` extension: each ticket with a zero age, and zero binders. */
const pskExtension = (offer: Offer): u8[] => {
  const identities: u8[][] = [];
  for (const ticket of offer.tickets) {
    identities.push(cat([vec16(ticket), filled(4, 0)]));
  }
  const binders: u8[][] = [];
  const count: i32 = toI32(offer.tickets.length) + offer.binderCountDelta;
  for (let k: i32 = 0; k < count; k++) {
    const length: i32 = k < toI32(offer.binderLengths.length) ? offer.binderLengths[k] : H;
    binders.push(vec8(filled(length, 0)));
  }
  return extension(EXT_PSK, cat([vec16(cat(identities)), vec16(cat(binders))]));
};

/** The ClientHello `offer` describes, every binder zero. */
export const buildHello = (offer: Offer, retry: boolean): u8[] => {
  const extensions: u8[][] = [extSupportedVersions([TLS_VERSION_13]), extSupportedGroups([TLS_GROUP_X25519, GROUP_SECP256R1])];
  if (offer.sigalgs) {
    extensions.push(extSignatureAlgorithms(offer.schemes));
  }
  if (retry) {
    extensions.push(extKeyShare([GROUP_SECP256R1], [filled(65, 4)]));
  } else {
    extensions.push(extKeyShare([TLS_GROUP_X25519], [offer.lowOrder ? filled(32, 0) : clientShare()]));
  }
  if (toI32(offer.name.length) > 0) {
    extensions.push(extServerName(offer.name));
  }
  if (offer.earlyData) {
    extensions.push(extension(EXT_EARLY_DATA, []));
  }
  if (offer.hasModes) {
    extensions.push(extension(EXT_PSK_MODES, vec8(offer.modes)));
  }
  if (toI32(offer.tickets.length) > 0 || offer.pskAlways) {
    extensions.push(pskExtension(offer));
    if (!offer.pskLast) {
      extensions.push(extension(0x4a4a, filled(4, 0)));
    }
  }
  const none: u8[] = [];
  return clientHelloRaw(TLS_LEGACY_VERSION, none, [SUITE], [toU8(0)], extensions);
};

/**
 * `hello` with the binder of identity `k` computed under `psk` over `before`
 * and the hello up to its binders (§4.2.11.2), as a client binds it.
 */
export const bindHello = (hello: u8[], before: u8[], k: i32, psk: u8[]): u8[] => {
  const view = new TlsClientHelloView();
  tlsReadClientHello(view, hello, 4, toI32(hello.length) - 4);
  if (view.alert !== 0 || !tlsSelectPskIdentity(view, k)) {
    return hello;
  }
  const hash: u8[] = transcriptHash(H, cat([before, range(hello, ZERO, view.pskBindersPrefixAt)]));
  const key: Secret<u8[]> = secret(copyOf(psk));
  const early: Secret<u8[]> = tlsPskEarlySecret(H, key);
  wipe(key);
  const binderKey: Secret<u8[]> = tlsBinderKey(H, early);
  wipe(early);
  const binder: u8[] = tlsFinishedVerifyData(H, binderKey, hash);
  wipe(binderKey);
  const out: u8[] = copyOf(hello);
  for (let j: i32 = 0; j < toI32(binder.length) && j < view.pskBinderLength; j++) {
    out[view.pskBinderAt + j] = binder[j];
  }
  return out;
};

/** Where extension `type` of a ServerHello starts (its type), or -1. */
const serverExtensionAt = (sh: u8[], type: i32): i32 => {
  if (toI32(sh.length) < 39) {
    return -1;
  }
  let at: i32 = 39 + toI32(sh[38]) + 5;
  while (at + 4 <= toI32(sh.length)) {
    const t: i32 = (toI32(sh[at]) << 8) | toI32(sh[at + 1]);
    const length: i32 = (toI32(sh[at + 2]) << 8) | toI32(sh[at + 3]);
    if (t === type) {
      return at;
    }
    at = at + 4 + length;
  }
  return -1;
};

/** The identity a ServerHello's `pre_shared_key` selects, or -1 when it has none. */
export const selectedIdentity = (sh: u8[]): i32 => {
  const at: i32 = serverExtensionAt(sh, EXT_PSK);
  if (at < 0 || at + 6 > toI32(sh.length)) {
    return -1;
  }
  return (toI32(sh[at + 4]) << 8) | toI32(sh[at + 5]);
};

/** The server's x25519 share, wherever its `key_share` sits. */
const shareOf = (sh: u8[]): u8[] => {
  const at: i32 = serverExtensionAt(sh, EXT_KEY_SHARE);
  return at < 0 ? [] : range(sh, at + 8, at + 40);
};

/** Every secret the client derives, the Finished it sends, and what it checked of the server's. */
export class Session {
  /** What the client hashes before the ServerHello, and the ServerHello. */
  transcript: u8[];
  handshakeSecret: u8[];
  clientHandshake: u8[];
  serverHandshake: u8[];
  clientApplication: u8[];
  serverApplication: u8[];
  resumption: u8[];
  /** The client's Finished, header included; empty until `finishWith`. */
  finished: u8[];
  /** How many messages the server's encrypted flight held. */
  messages: i32 = 0;
  /** Whether the server's Finished verified under the server handshake secret. */
  serverFinished: boolean = false;

  constructor() {
    this.transcript = [];
    this.handshakeSecret = [];
    this.clientHandshake = [];
    this.serverHandshake = [];
    this.clientApplication = [];
    this.serverApplication = [];
    this.resumption = [];
    this.finished = [];
  }

  /** The rest, once the client has opened the server's flight. */
  finishWith(flight: u8[]): void {
    const messages: u8[][] = splitMessages(flight);
    this.messages = toI32(messages.length);
    if (this.messages < 2) {
      return;
    }
    const last: u8[] = messages[this.messages - 1];
    const beforeFinished: u8[] = range(flight, ZERO, toI32(flight.length) - toI32(last.length));
    const serverKey: Secret<u8[]> = secret(copyOf(this.serverHandshake));
    const expected: u8[] = tlsFinishedVerifyData(H, serverKey, transcriptHash(H, cat([this.transcript, beforeFinished])));
    wipe(serverKey);
    this.serverFinished = toI32(last[0]) === 20 && sameBytes(range(last, 4, toI32(last.length)), expected);
    const flightHash: u8[] = transcriptHash(H, cat([this.transcript, flight]));
    const handshakeSecret: Secret<u8[]> = secret(copyOf(this.handshakeSecret));
    const master: Secret<u8[]> = tlsMasterSecret(H, handshakeSecret);
    wipe(handshakeSecret);
    const clientApplication: Secret<u8[]> = tlsDeriveSecret(H, master, "c ap traffic", flightHash);
    const serverApplication: Secret<u8[]> = tlsDeriveSecret(H, master, "s ap traffic", flightHash);
    this.clientApplication = secretCopy(clientApplication);
    this.serverApplication = secretCopy(serverApplication);
    wipe(clientApplication);
    wipe(serverApplication);
    const clientKey: Secret<u8[]> = secret(copyOf(this.clientHandshake));
    this.finished = cat([[toU8(20), toU8(0), toU8(0), toU8(H)], tlsFinishedVerifyData(H, clientKey, flightHash)]);
    wipe(clientKey);
    const resumption: Secret<u8[]> = tlsDeriveSecret(
      H,
      master,
      "res master",
      transcriptHash(H, cat([this.transcript, flight, this.finished]))
    );
    wipe(master);
    this.resumption = secretCopy(resumption);
    wipe(resumption);
  }
}

/**
 * The client's handshake secrets for a server that answered `sh` to the
 * messages `before`: under `psk` when it resumed, else under no PSK.
 */
export const sessionFor = (psk: u8[], before: u8[], sh: u8[]): Session => {
  const session = new Session();
  const shared: u8[] | null = x25519Plain(clientPrivate(), shareOf(sh));
  const none: u8[] = [];
  let early: Secret<u8[]> = tlsEarlySecret(H);
  if (toI32(psk.length) > 0) {
    wipe(early);
    const key: Secret<u8[]> = secret(copyOf(psk));
    early = tlsPskEarlySecret(H, key);
    wipe(key);
  }
  const ecdhe: Secret<u8[]> = secret(copyOf(shared === null ? none : shared));
  const handshakeSecret: Secret<u8[]> = tlsHandshakeSecret(H, early, ecdhe);
  wipe(early);
  wipe(ecdhe);
  session.transcript = cat([before, sh]);
  const helloHash: u8[] = transcriptHash(H, session.transcript);
  const clientHandshake: Secret<u8[]> = tlsDeriveSecret(H, handshakeSecret, "c hs traffic", helloHash);
  const serverHandshake: Secret<u8[]> = tlsDeriveSecret(H, handshakeSecret, "s hs traffic", helloHash);
  session.handshakeSecret = secretCopy(handshakeSecret);
  session.clientHandshake = secretCopy(clientHandshake);
  session.serverHandshake = secretCopy(serverHandshake);
  wipe(handshakeSecret);
  wipe(clientHandshake);
  wipe(serverHandshake);
  return session;
};

/** A ticket as the client keeps it: what it sends back, and the PSK it binds with. */
export class Ticket {
  ok: boolean = false;
  ticket: u8[];
  psk: u8[];
  lifetime: i32 = 0;
  nonce: u8[];

  constructor() {
    this.ticket = [];
    this.psk = [];
    this.nonce = [];
  }
}

/** The ticket a NewSessionTicket `nst` carries, its PSK derived from `rms` (§4.6.1). */
export const ticketFrom = (nst: u8[], rms: u8[]): Ticket => {
  const out = new Ticket();
  if (toI32(nst.length) < 13 || toI32(nst[0]) !== 4) {
    return out;
  }
  out.lifetime = (toI32(nst[4]) << 24) | (toI32(nst[5]) << 16) | (toI32(nst[6]) << 8) | toI32(nst[7]);
  const nonceLength: i32 = toI32(nst[12]);
  out.nonce = range(nst, 13, 13 + nonceLength);
  const at: i32 = 13 + nonceLength;
  if (at + 2 > toI32(nst.length)) {
    return out;
  }
  const length: i32 = (toI32(nst[at]) << 8) | toI32(nst[at + 1]);
  out.ticket = range(nst, at + 2, at + 2 + length);
  const master: Secret<u8[]> = secret(copyOf(rms));
  const psk: Secret<u8[]> = tlsResumptionPsk(H, master, out.nonce);
  wipe(master);
  out.psk = secretCopy(psk);
  wipe(psk);
  out.ok = toI32(out.ticket.length) === length && length > 0;
  return out;
};

/** The ticket keys and the strike register a carrier lends: the current key, the previous one, and the register. */
export class Ring {
  readonly key: Secret<u8[]>;
  info: TlsTicketKeyInfo;
  readonly previous: Secret<u8[]>;
  previousInfo: TlsTicketKeyInfo;
  strikes: TlsTicketStrikes;

  constructor(capacity: i32) {
    this.previousInfo = new TlsTicketKeyInfo();
    const previous: Secret<u8[]> = tlsTicketKeyDraw(this.previousInfo, START);
    this.previous = secret(secretCopy(previous));
    wipe(previous);
    this.info = new TlsTicketKeyInfo();
    const key: Secret<u8[]> = tlsTicketKeyDraw(this.info, START);
    this.key = secret(secretCopy(key));
    wipe(key);
    this.strikes = new TlsTicketStrikes(capacity);
  }

  wipe(): void {
    wipe(this.key);
    wipe(this.previous);
  }
}

/** A ticket state for `SUITE`, named `name`, under the PSK `psk`, its chain begun at `chainStart`. */
export const ticketState = (psk: u8[], name: string, chainStart: i64): TlsTicketState => {
  const state = new TlsTicketState();
  state.suite = SUITE;
  state.lifetime = 7200;
  state.chainStart = chainStart;
  for (let k: i32 = 0; k < toI32(name.length); k++) {
    state.serverName[k] = toU8(name.charCodeAt(k));
  }
  state.serverNameLength = toI32(name.length);
  state.pskLength = toI32(psk.length);
  for (let k: i32 = 0; k < toI32(psk.length) && k < toI32(state.psk.length); k++) {
    state.psk[k] = psk[k];
  }
  return state;
};

/** `state` sealed under `key` at `now`, as a server would issue it; empty when the seal refuses. */
export const sealTicket = (key: Secret<u8[]>, info: TlsTicketKeyInfo, state: TlsTicketState, now: i64): u8[] => {
  const out: u8[] = new Array<u8>(tlsTicketSize(state));
  const n: i32 = tlsTicketSeal(key, info, state, now, out);
  return n <= 0 ? [] : range(out, ZERO, n);
};

/** The PSK the crafted tickets carry. */
export const craftedPsk = (): u8[] => filled(H, 9);

/** What one handshake through a `TlsRecordServer` came to. */
export class Run {
  /** The connection's state after the hello, and its alert. */
  state: i32 = 0;
  alert: i32 = 0;
  /** Whether the server waited on `resume`, and on a signature. */
  askedTicket: boolean = false;
  signed: boolean = false;
  resumed: boolean = false;
  /** The identity the ServerHello selected, or -1. */
  selected: i32 = -1;
  /** Whether the client's Finished went in and the connection opened. */
  open: boolean = false;
  /** Whether `TLS_RECORD_TICKET` was up once the connection opened. */
  ticketOwed: boolean = false;
  session: Session;
  ticket: Ticket;
  /** The ClientHello's record and the client Finished's, as sent, for replaying. */
  helloRecord: u8[];
  finishedRecord: u8[];
  /** The server's own time on the handshake, in nanoseconds, and the bytes both sides put on the wire. */
  serverNanos: i64 = 0;
  wireBytes: i32 = 0;

  constructor() {
    this.session = new Session();
    this.ticket = new Ticket();
    this.helloRecord = [];
    this.finishedRecord = [];
  }
}

/**
 * One handshake of `conn`, a fresh `TlsRecordServer`, with the ClientHello
 * `offer` describes, `ring` lent to `resume` at `now`. When `finish`, the
 * client's Finished follows a flight that verifies; when `issue` too, a
 * ticket is asked for once the connection is open and read back.
 */
export const runOn = (conn: TlsRecordServer, ring: Ring, offer: Offer, now: i64, finish: boolean, issue: boolean): Run => {
  const run = new Run();
  let before: u8[] = [];
  if (offer.retry) {
    const first: u8[] = buildHello(offer, true);
    feed(conn, clearRecord(first));
    const records: u8[][] = splitRecords(drain(conn));
    if (toI32(records.length) === 0) {
      run.state = conn.state;
      run.alert = conn.alert;
      return run;
    }
    const retryRequest: u8[] = range(records[0], 5, toI32(records[0].length));
    before = cat([[toU8(254), toU8(0), toU8(0), toU8(H)], transcriptHash(H, first), retryRequest]);
  }
  let hello: u8[] = buildHello(offer, false);
  if (toI32(offer.psk.length) > 0) {
    const none: u8[] = [];
    hello = bindHello(hello, offer.bindAlone ? none : before, offer.bindIndex, offer.psk);
  }
  run.helloRecord = clearRecord(hello);
  let started: i64 = monotonicNanos();
  feed(conn, run.helloRecord);
  if ((conn.interest() & TLS_RECORD_TICKET) !== 0) {
    run.askedTicket = true;
    conn.resume(ring.key, ring.info, ring.previous, ring.previousInfo, ring.strikes, now);
  }
  if ((conn.interest() & TLS_RECORD_SIGN) !== 0) {
    run.signed = true;
    const input: u8[] | null = conn.signatureInput();
    const leaf: Secret<u8[]> = secret(leafPrivate());
    const signature: u8[] | null = input === null ? null : tlsSignEcdsaP256(leaf, input);
    wipe(leaf);
    const none: u8[] = [];
    conn.sign(signature === null ? none : signature);
  }
  run.resumed = conn.tls.resumed;
  run.state = conn.state;
  run.alert = conn.alert;
  const flight: u8[] = drain(conn);
  run.serverNanos = run.serverNanos + (monotonicNanos() - started);
  run.wireBytes = toI32(run.helloRecord.length) + toI32(flight.length);
  const records: u8[][] = splitRecords(flight);
  if (toI32(records.length) === 0 || toI32(records[0][0]) !== TLS_CONTENT_HANDSHAKE) {
    return run;
  }
  const sh: u8[] = range(records[0], 5, toI32(records[0].length));
  run.selected = selectedIdentity(sh);
  run.session = sessionFor(run.selected >= 0 ? offer.psk : [], cat([before, hello]), sh);
  const reader = protectionFor(SUITE, run.session.serverHandshake);
  const parts: u8[][] = [];
  for (let k: i32 = 1; k < toI32(records.length); k++) {
    parts.push(openOne(reader, records[k]).content);
  }
  run.session.finishWith(join(parts));
  if (!finish || !run.session.serverFinished) {
    return run;
  }
  run.finishedRecord = sealOne(protectionFor(SUITE, run.session.clientHandshake), TLS_CONTENT_HANDSHAKE, run.session.finished, ZERO);
  started = monotonicNanos();
  feed(conn, run.finishedRecord);
  run.serverNanos = run.serverNanos + (monotonicNanos() - started);
  run.wireBytes = run.wireBytes + toI32(run.finishedRecord.length);
  run.state = conn.state;
  run.alert = conn.alert;
  run.open = conn.state === TLS_RECORD_STATE_OPEN;
  run.ticketOwed = run.open && (conn.interest() & TLS_RECORD_TICKET) !== 0;
  if (!issue || !run.ticketOwed) {
    return run;
  }
  started = monotonicNanos();
  conn.issue(ring.key, ring.info, now);
  const sent: u8[] = drain(conn);
  run.serverNanos = run.serverNanos + (monotonicNanos() - started);
  run.wireBytes = run.wireBytes + toI32(sent.length);
  const issued: u8[][] = splitRecords(sent);
  if (toI32(issued.length) === 0) {
    return run;
  }
  const nst: u8[] = openOne(protectionFor(SUITE, run.session.serverApplication), issued[0]).content;
  run.ticket = ticketFrom(nst, run.session.resumption);
  return run;
};
