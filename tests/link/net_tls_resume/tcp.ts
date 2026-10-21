// The carrier's half of the resumption tests: a `TlsTcpServer` with tickets
// on, one slot, and a plain `nish:net` client over loopback. A full
// handshake is issued a ticket through `TlsTcpServer.issue`, and a second
// connection, accepted into the same slot once the first has closed, offers
// it and is resumed through `TlsTcpServer.resume`. Every wait is bounded:
// five seconds without a wake is a failure, never a hang.
import { Suite } from "nish/testing";
import { Secret, secret, wipe } from "nish:secret";
import {
  connectResult,
  netAddress,
  netClose,
  netLocalPort,
  netRead,
  netWrite,
  pollAdd,
  pollCreate,
  pollRemove,
  pollWait,
  tcpConnect,
  tcpListen,
} from "nish:net";
import { TLS_HANDSHAKE_FINISHED } from "nish/net/tls/codec";
import { TLS_CONTENT_HANDSHAKE } from "nish/net/tls/record";
import {
  TLS_RECORD_DONE,
  TLS_RECORD_SIGN,
  TLS_RECORD_STATE_HANDSHAKE,
  TLS_RECORD_STATE_OPEN,
  TLS_RECORD_TICKET,
} from "nish/net/tls/record-server";
import { TlsTcpServer } from "nish/net/tls-tcp";
import { leafPrivate, serverPrivate, serverRandom, tcpConfig } from "../net_tls_common/server";
import { clearRecord, splitRecords } from "../net_tls_record_common/client";
import { ZERO, join, openOne, protectionFor, range, sealOne } from "../net_tls_record_common/bytes";
import {
  Offer,
  Ring,
  Run,
  START,
  SUITE,
  bindHello,
  buildHello,
  honestShare,
  offerOf,
  selectedIdentity,
  sessionFor,
  shareOf,
  ticketFrom,
} from "./client";

const WOULD_BLOCK: i32 = -11;

/** One poll set holding a single descriptor at a time; true once `fd` is ready for `events` within five seconds. */
const ready = (fd: i32, events: i32): boolean => {
  const loop: i32 = pollCreate();
  pollAdd(loop, fd, events, toI32(1));
  const slots: i32[] = new Array<i32>(2);
  const n: i32 = pollWait(loop, slots, toI32(5000));
  pollRemove(loop, fd);
  netClose(loop);
  return n > 0;
};

/** Every byte of `bytes` written to `fd`; false if the socket refused them. */
const sendAll = (fd: i32, bytes: u8[]): boolean => {
  let at: i32 = 0;
  while (at < toI32(bytes.length)) {
    const n: i32 = netWrite(fd, bytes, at, toI32(bytes.length) - at);
    if (n > 0) {
      at = at + n;
    } else if (n !== WOULD_BLOCK || !ready(fd, toI32(2))) {
      return false;
    }
  }
  return true;
};

/** What has reached `fd` once it is readable, read onto `out` until nothing more is waiting; false if nothing came. */
const collectOnto = (fd: i32, out: u8[]): boolean => {
  if (!ready(fd, toI32(1))) {
    return false;
  }
  const buf: u8[] = new Array<u8>(4096);
  let reading: boolean = true;
  while (reading) {
    const n: i32 = netRead(fd, buf, ZERO, toI32(buf.length));
    for (let k: i32 = 0; k < n; k++) {
      out.push(buf[k]);
    }
    reading = n > 0;
  }
  return true;
};

/**
 * The whole records that reach `fd`, read until there is at least one and none
 * is cut short. Darwin's loopback hands each write over on its own, so one read
 * can end inside a record.
 */
const collect = (fd: i32): u8[][] => {
  const out: u8[] = [];
  let records: u8[][] = [];
  while (!whole(out, records) && collectOnto(fd, out)) {
    records = splitRecords(out);
  }
  return records;
};

/** Every byte of `stream` in `records`, and at least one record. */
const whole = (stream: u8[], records: u8[][]): boolean => {
  let total: i32 = 0;
  for (const record of records) {
    total = total + toI32(record.length);
  }
  return total > 0 && total === toI32(stream.length);
};

/** Handshake messages, every one whole, the last a Finished. */
const endsFinished = (messages: u8[]): boolean => {
  const n: i32 = toI32(messages.length);
  let at: i32 = 0;
  let last: i32 = -1;
  while (at + toI32(4) <= n) {
    last = toI32(messages[at]);
    at = at + toI32(4) + ((toI32(messages[at + 1]) << 16) | (toI32(messages[at + 2]) << 8) | toI32(messages[at + 3]));
  }
  return at === n && last === TLS_HANDSHAKE_FINISHED;
};

/** The listener, the carrier on it with tickets on, and its one slot. */
class Carrier {
  listener: i32 = -1;
  port: i32 = 0;
  server: TlsTcpServer;

  constructor() {
    this.listener = tcpListen("127.0.0.1", ZERO, toI32(4));
    this.port = netLocalPort(this.listener);
    this.server = new TlsTcpServer(tcpConfig([]), this.listener, toI32(1));
    this.server.enableTickets();
  }

  /** A client connected and accepted: its descriptor and the slot, or -1 in either. */
  connect(): i32[] {
    const addr: u8[] = new Array<u8>(18);
    netAddress(addr, "127.0.0.1", this.port);
    const fd: i32 = tcpConnect(addr);
    if (fd < 0 || !ready(fd, toI32(2)) || connectResult(fd) !== 0 || !ready(this.listener, toI32(1))) {
      return [fd, toI32(-1)];
    }
    return [fd, this.server.accept(serverRandom(), serverPrivate())];
  }

  /** The slot's socket has the client's bytes: reads them, then answers `resume` and a signature as its interest asks. */
  serve(slot: i32, ring: Ring, now: i64, run: Run): i32 {
    if (!ready(this.server.fd(slot), toI32(1))) {
      return TLS_RECORD_DONE;
    }
    let wants: i32 = this.server.readable(slot);
    // Darwin's loopback can hand over part of what the client wrote: read on until the handshake moves.
    const conn = this.server.connection(slot);
    while (
      (wants & (TLS_RECORD_TICKET | TLS_RECORD_SIGN)) === 0 &&
      conn.state === TLS_RECORD_STATE_HANDSHAKE &&
      !conn.peerClosed &&
      ready(this.server.fd(slot), toI32(1))
    ) {
      wants = this.server.readable(slot);
    }
    if ((wants & TLS_RECORD_TICKET) !== 0 && conn.state !== TLS_RECORD_STATE_OPEN) {
      run.askedTicket = true;
      wants = this.server.resume(slot, ring.key, ring.info, ring.previous, ring.previousInfo, ring.strikes, now);
    }
    if ((wants & TLS_RECORD_SIGN) !== 0) {
      run.signed = true;
      const leaf: Secret<u8[]> = secret(leafPrivate());
      wants = this.server.signP256(slot, leaf);
      wipe(leaf);
    }
    return wants;
  }

  /** Closes the slot and every socket. */
  shutdown(): void {
    netClose(this.listener);
  }
}

/** One handshake over loopback with the ClientHello `offer` describes, to the client Finished and the ticket it is issued. */
const runTcp = (carrier: Carrier, ring: Ring, offer: Offer, now: i64): Run => {
  const run = new Run();
  const ends: i32[] = carrier.connect();
  const fd: i32 = ends[0];
  const slot: i32 = ends[1];
  if (slot < 0) {
    if (fd >= 0) {
      netClose(fd);
    }
    return run;
  }
  let hello: u8[] = buildHello(offer, false);
  if (toI32(offer.psk.length) > 0) {
    const none: u8[] = [];
    hello = bindHello(hello, none, offer.bindIndex, offer.psk);
  }
  sendAll(fd, clearRecord(hello));
  carrier.serve(slot, ring, now, run);
  const conn = carrier.server.connection(slot);
  run.resumed = conn.tls.resumed;
  // The server's flight is two writes when it signs, which Darwin's loopback hands over apart: read until it ends in its Finished.
  const flight: u8[] = [];
  let records: u8[][] = [];
  let messages: u8[] = [];
  while (!endsFinished(messages) && collectOnto(fd, flight)) {
    records = splitRecords(flight);
    if (toI32(records.length) > 0 && toI32(records[0][0]) === TLS_CONTENT_HANDSHAKE) {
      const sh: u8[] = range(records[0], toI32(5), toI32(records[0].length));
      run.selected = selectedIdentity(sh);
      run.share = shareOf(sh);
      run.session = sessionFor(run.selected >= 0 ? offer.psk : [], hello, sh);
      const reader = protectionFor(SUITE, run.session.serverHandshake);
      const parts: u8[][] = [];
      for (let k: i32 = 1; k < toI32(records.length); k++) {
        parts.push(openOne(reader, records[k]).content);
      }
      messages = join(parts);
    }
  }
  if (toI32(records.length) > 0 && toI32(records[0][0]) === TLS_CONTENT_HANDSHAKE) {
    run.session.finishWith(messages);
  }
  if (run.session.serverFinished) {
    sendAll(fd, sealOne(protectionFor(SUITE, run.session.clientHandshake), TLS_CONTENT_HANDSHAKE, run.session.finished, ZERO));
    const wants: i32 = carrier.serve(slot, ring, now, run);
    run.open = conn.state === TLS_RECORD_STATE_OPEN;
    run.ticketOwed = run.open && (wants & TLS_RECORD_TICKET) !== 0;
  }
  if (run.ticketOwed) {
    carrier.server.issue(slot, ring.key, ring.info, now);
    const issued: u8[][] = collect(fd);
    if (toI32(issued.length) > 0) {
      run.ticket = ticketFrom(openOne(protectionFor(SUITE, run.session.serverApplication), issued[0]).content, run.session.resumption);
    }
  }
  run.state = conn.state;
  carrier.server.close(slot);
  netClose(fd);
  return run;
};

/** `TlsTcpServer.enableTickets`, `resume` and `issue`, over loopback through one slot. */
export const tcpChecks = (t: Suite): void => {
  const ring = new Ring(toI32(64));
  const carrier = new Carrier();
  const first: Run = runTcp(carrier, ring, new Offer(), START);
  t.ok("tcp: a full handshake through the carrier opens and signs", first.open && first.signed && !first.resumed);
  t.ok("tcp: and is owed a ticket", first.ticketOwed);
  t.ok("tcp: the ticket TlsTcpServer.issue sends reads back", first.ticket.ok);
  const again: Run = runTcp(carrier, ring, offerOf(first.ticket.ticket, first.ticket.psk), START);
  t.ok("tcp: the slot, restarted, asks about the offered ticket", again.askedTicket);
  t.ok("tcp: TlsTcpServer.resume resumes it, unsigned, identity 0", again.resumed && !again.signed && again.selected === ZERO);
  t.ok("tcp: the resumed connection opens and is issued a ticket too", again.open && again.ticket.ok);
  t.ok("tcp: a resumed ServerHello carries the server's own x25519 share", honestShare(again.share));
  t.eqI32("tcp: one strike is live", ring.strikes.live(START), toI32(1));
  const replay: Run = runTcp(carrier, ring, offerOf(first.ticket.ticket, first.ticket.psk), START);
  t.ok("tcp: the same ticket again falls back to a full handshake", replay.open && replay.signed && !replay.resumed);
  t.ok("tcp: and that fallback's ServerHello carries the server's own x25519 share", honestShare(replay.share));
  t.eqI32("tcp: resume on a slot it does not hold answers TLS_RECORD_DONE", carrier.server.resume(toI32(0), ring.key, ring.info, ring.previous, ring.previousInfo, ring.strikes, START), TLS_RECORD_DONE);
  t.eqI32("tcp: and so does issue", carrier.server.issue(toI32(0), ring.key, ring.info, START), TLS_RECORD_DONE);
  carrier.shutdown();
  ring.wipe();
};
