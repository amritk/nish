// What resumption saves: full handshakes against resumed ones through a
// `TlsRecordServer`, in interleaved rounds, each handshake on a server whose
// random and x25519 key are drawn fresh from a seeded generator. A third
// column runs the full handshake again, byte for byte the same code, so the
// gap between the two full columns is the noise band the resumed one is read
// against. Each handshake's server time (the client's own work left out) and
// the bytes both sides sent are measured; the counts, the bytes and a
// checksum folded from every session's traffic secret go to stdout, the
// medians to stderr, which `tests/run.js` reads.
import { TlsServer } from "nish/net/tls";
import { TlsRecordServer } from "nish/net/tls/record-server";
import { tcpConfig } from "../net_tls_common/server";
import { Offer, Ring, Run, START, offerOf, runOn } from "../net_tls_resume/client";

/** Rounds, each one handshake of every column. */
const ROUNDS: i32 = 41;

/** A seeded linear congruential generator, so stdout is the same on every run. */
class Draw {
  state: i64 = 20251019;

  byte(): u8 {
    this.state = (this.state * toI64(1103515245) + toI64(12345)) % (toI64(65536) * toI64(32768));
    return toU8(toI32(this.state / toI64(65536)) & 255);
  }

  bytes(n: i32): u8[] {
    const out: u8[] = [];
    for (let k: i32 = 0; k < n; k++) {
      out.push(this.byte());
    }
    return out;
  }
}

/** A fresh connection with tickets on, its random and key drawn from `draw`. */
const fresh = (draw: Draw): TlsRecordServer => {
  const tls = new TlsServer(tcpConfig([]), draw.bytes(32), draw.bytes(32));
  tls.enableTickets();
  return new TlsRecordServer(tls);
};

/** `checksum` with `bytes` folded in. */
const fold = (checksum: i32, bytes: u8[]): i32 => {
  let out: i32 = checksum;
  for (const b of bytes) {
    out = ((out * 31) + toI32(b)) & 0xffffff;
  }
  return out;
};

/** The median of `values`, sorted in place. */
const median = (values: i64[]): i64 => {
  for (let i: i32 = 1; i < toI32(values.length); i++) {
    const v: i64 = values[i];
    let j: i32 = i - 1;
    while (j >= 0 && values[j] > v) {
      values[j + 1] = values[j];
      j = j - 1;
    }
    values[j + 1] = v;
  }
  return values[toI32(values.length) / 2];
};

export const main = (): i32 => {
  const draw = new Draw();
  const ring = new Ring(1024);
  const full: i64[] = [];
  const copy: i64[] = [];
  const resumed: i64[] = [];
  let fullOpened: i32 = 0;
  let copyOpened: i32 = 0;
  let resumedOpened: i32 = 0;
  let fullBytes: i32 = 0;
  let resumedBytes: i32 = 0;
  let checksum: i32 = 0;
  for (let round: i32 = 0; round < ROUNDS; round++) {
    const a: Run = runOn(fresh(draw), ring, new Offer(), START, true, true);
    full.push(a.serverNanos);
    if (a.open && a.signed && !a.resumed && a.ticket.ok) {
      fullOpened = fullOpened + 1;
    }
    fullBytes = fullBytes + a.wireBytes;
    checksum = fold(checksum, a.session.serverApplication);

    const b: Run = runOn(fresh(draw), ring, new Offer(), START, true, true);
    copy.push(b.serverNanos);
    if (b.open && b.signed && !b.resumed && b.ticket.ok) {
      copyOpened = copyOpened + 1;
    }
    checksum = fold(checksum, b.session.serverApplication);

    const offer: Offer = offerOf(a.ticket.ticket, a.ticket.psk);
    const c: Run = runOn(fresh(draw), ring, offer, START, true, true);
    resumed.push(c.serverNanos);
    if (c.open && c.resumed && !c.signed && c.selected === 0 && c.ticket.ok) {
      resumedOpened = resumedOpened + 1;
    }
    resumedBytes = resumedBytes + c.wireBytes;
    checksum = fold(checksum, [toU8(c.selected + 1)]);
  }
  ring.wipe();
  console.log(`resume bench: ${ROUNDS} rounds`);
  console.log(`full: ${fullOpened} opened, signed and issued a ticket`);
  console.log(`full copy: ${copyOpened} opened, signed and issued a ticket`);
  console.log(`resumed: ${resumedOpened} opened without a signature and issued a ticket`);
  console.log(`bytes per handshake: full ${fullBytes / ROUNDS}, resumed ${resumedBytes / ROUNDS}`);
  console.log(`checksum: ${checksum}`);
  console.error(`resume bench ns: full ${median(full)} copy ${median(copy)} resumed ${median(resumed)}`);
  return 0;
};
