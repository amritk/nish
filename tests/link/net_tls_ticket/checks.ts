// `nish/net/tls/ticket` (#627, "Resumption" in docs/security/tls.md): the
// tickets a server seals for itself and the strike register that makes each
// one single-use. Every time is handed in, so each bound is checked at the
// instant it holds and one nanosecond past it:
//
//   1. A round trip under each suite, and a flipped bit in each region of a
//      ticket (key id, nonce, ciphertext, tag) refused; after a tag that does
//      not verify, the state's PSK array reads zero.
//   2. A ticket's own bounds: its expiry, its issue time, the 24 h chain
//      bound, a sealed lifetime over 7200 s and a chain that starts after its
//      ticket, the last two sealed here because the test holds the key.
//   3. A key's bounds: 12 h of sealing, 14 h of opening, the seal cap, and
//      `tlsTicketKeyDue` at the window's end and at the cap; a ticket under
//      an unknown key id.
//   4. The rotation turn, three times: a ticket under the previous key opens
//      until the turn after, and not then. `ticketRotationTurns` is a root of
//      the wipe count in `tests/wipes/tls.js`.
//   5. The strike register: replay, the clamp to one server lifetime, a full
//      register that refuses and counts, re-taking after expiry, and a live id
//      behind an expired slot of its probe chain.
//
// `tests/link/net_tls_ticket_f64` runs the same checks under
// `--number-mode f64`.
import { Suite } from "nish/testing";
import { Secret, wipe } from "nish:secret";
import { TLS_AES_128_GCM_SHA256, TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256, tlsSuiteHashLength } from "nish/net/tls/schedule";
import {
  TLS_TICKET_CHAIN_LIMIT,
  TLS_TICKET_KEY_ID_SIZE,
  TLS_TICKET_NONCE_SIZE,
  TLS_TICKET_OPEN_WINDOW,
  TLS_TICKET_SEAL_WINDOW,
  TlsTicketKeyInfo,
  TlsTicketState,
  TlsTicketStrikes,
  tlsTicketKeyDraw,
  tlsTicketKeyDue,
  tlsTicketOpen,
  tlsTicketSeal,
  tlsTicketSize,
} from "nish/net/tls/ticket";

const SECOND: i64 = 1000000000;
const MINUTE: i64 = SECOND * 60;
const HOUR: i64 = MINUTE * 60;
/** An arbitrary awake time at which the tests start, well clear of 0. */
const START: i64 = HOUR * 100;

/** A state for `suite`: a server name, a PSK of the suite's hash length, the full lifetime, and a chain that starts at `chainStart`. */
const stateFor = (suite: i32, chainStart: i64): TlsTicketState => {
  const state = new TlsTicketState();
  state.suite = suite;
  state.lifetime = 7200;
  state.chainStart = chainStart;
  const name: string = "tickets.example";
  for (let k: i32 = 0; k < toI32(name.length); k++) {
    state.serverName[k] = toU8(name.charCodeAt(k));
  }
  state.serverNameLength = toI32(name.length);
  state.pskLength = tlsSuiteHashLength(suite);
  for (let k: i32 = 0; k < state.pskLength; k++) {
    state.psk[k] = toU8(k * 7 + 3);
  }
  return state;
};

/** Seals `state` under `key` at `now` into a ticket of exactly its size; empty when the seal refuses. */
const sealed = (key: Secret<u8[]>, info: TlsTicketKeyInfo, state: TlsTicketState, now: i64): u8[] => {
  const out: u8[] = new Array<u8>(tlsTicketSize(state));
  const written: i32 = tlsTicketSeal(key, info, state, now, out);
  if (written === 0) {
    const none: u8[] = [];
    return none;
  }
  return out;
};

/** A copy of `bytes[from .. to)`. */
const range = (bytes: u8[], from: i32, to: i32): u8[] => {
  const out: u8[] = new Array<u8>(to - from);
  for (let k: i32 = 0; k < toI32(out.length); k++) {
    const at: i32 = from + k;
    if (at >= 0 && at < toI32(bytes.length)) {
      out[k] = bytes[at];
    }
  }
  return out;
};

/** True when the first `n` bytes of `a` and `b` agree. */
const same = (a: u8[], b: u8[], n: i32): boolean => {
  for (let k: i32 = 0; k < n; k++) {
    if (k >= toI32(a.length) || k >= toI32(b.length) || a[k] !== b[k]) {
      return false;
    }
  }
  return true;
};

/** How many of `bytes`' first `n` are not zero. */
const held = (bytes: u8[], n: i32): i32 => {
  let count: i32 = 0;
  for (let k: i32 = 0; k < n && k < toI32(bytes.length); k++) {
    if (bytes[k] !== 0) {
      count++;
    }
  }
  return count;
};

/** A copy of `ticket` with bit 0 of byte `at` flipped. */
const flipped = (ticket: u8[], at: i32): u8[] => {
  const copy: u8[] = range(ticket, 0, toI32(ticket.length));
  copy[at] = toU8(toI32(copy[at]) ^ 1);
  return copy;
};

/** 1. A round trip under `suite`: every field of the state comes back, and the id is the ticket's nonce. */
const roundTrip = (t: Suite, name: string, suite: i32): void => {
  const info = new TlsTicketKeyInfo();
  const key: Secret<u8[]> = tlsTicketKeyDraw(info, START);
  const state: TlsTicketState = stateFor(suite, START - HOUR);
  const ticket: u8[] = sealed(key, info, state, START + MINUTE);
  t.eqI32(`${name}: the ticket is key id, nonce, plaintext and tag`, toI32(ticket.length), toI32(16 + 12 + 24 + 15 + 16) + state.pskLength);
  t.ok(`${name}: and it leads with the key's id`, same(ticket, info.id, TLS_TICKET_KEY_ID_SIZE));
  const out = new TlsTicketState();
  t.ok(`${name}: it opens`, tlsTicketOpen(key, info, ticket, START + MINUTE * 2, out));
  t.ok(
    `${name}: with the suite, issue time, lifetime and chain start sealed`,
    out.suite === suite && out.issuedAt === START + MINUTE && out.lifetime === 7200 && out.chainStart === START - HOUR
  );
  t.ok(
    `${name}: and the server name and PSK`,
    out.serverNameLength === 15 && same(out.serverName, state.serverName, 15) && out.pskLength === state.pskLength && same(out.psk, state.psk, state.pskLength)
  );
  t.ok(`${name}: and its id is the ticket's nonce`, same(out.id, range(ticket, TLS_TICKET_KEY_ID_SIZE, TLS_TICKET_KEY_ID_SIZE + TLS_TICKET_NONCE_SIZE), TLS_TICKET_NONCE_SIZE));
  t.eqI64(`${name}: the key counts the ticket`, info.sealed, toI64(1));
  wipe(key);
};

/** 1. A flipped bit in each region of a ticket, and the PSK array wiped after a refused tag. */
const tampering = (t: Suite): void => {
  const info = new TlsTicketKeyInfo();
  const key: Secret<u8[]> = tlsTicketKeyDraw(info, START);
  const ticket: u8[] = sealed(key, info, stateFor(TLS_AES_256_GCM_SHA384, START), START);
  const last: i32 = toI32(ticket.length) - 1;
  const out = new TlsTicketState();
  t.ok("the untouched ticket opens", tlsTicketOpen(key, info, ticket, START, out));
  t.eqI32("and fills the state's PSK", held(out.psk, 48), toI32(48));
  t.ok("a flipped bit in the key id: refused", !tlsTicketOpen(key, info, flipped(ticket, 0), START, out));
  t.ok("a flipped bit in the nonce: refused", !tlsTicketOpen(key, info, flipped(ticket, 16), START, out));
  t.ok("a flipped bit in the ciphertext: refused", !tlsTicketOpen(key, info, flipped(ticket, 30), START, out));
  t.ok("a flipped bit in the tag: refused", !tlsTicketOpen(key, info, flipped(ticket, last), START, out));
  t.eqI32("and after a tag that does not verify, the state's PSK array reads zero", held(out.psk, 48), toI32(0));
  const unknown: u8[] = new Array<u8>(toI32(ticket.length));
  crypto.getRandomValues(unknown);
  t.ok("a ticket of random bytes, under an unknown key id: refused", !tlsTicketOpen(key, info, unknown, START, out));
  t.ok("a ticket cut short: refused", !tlsTicketOpen(key, info, range(ticket, 0, last), START, out));
  wipe(key);
};

/** 2. The ticket's own bounds. */
const ticketBounds = (t: Suite): void => {
  const info = new TlsTicketKeyInfo();
  const key: Secret<u8[]> = tlsTicketKeyDraw(info, START);
  const out = new TlsTicketState();
  const issued: i64 = START + HOUR;
  const ticket: u8[] = sealed(key, info, stateFor(TLS_AES_128_GCM_SHA256, START), issued);
  t.ok("a ticket opens at its issue time", tlsTicketOpen(key, info, ticket, issued, out));
  t.ok("and not 1 ns before it", !tlsTicketOpen(key, info, ticket, issued - 1, out));
  t.ok("it opens at its expiry, issue time plus 7200 s", tlsTicketOpen(key, info, ticket, issued + SECOND * 7200, out));
  t.ok("and not 1 ns after", !tlsTicketOpen(key, info, ticket, issued + SECOND * 7200 + 1, out));
  t.eqI32("and a ticket refused past its expiry leaves the PSK array zero", held(out.psk, 32), toI32(0));

  // The chain bound: a chain that started 23 h 30 min before the ticket.
  const chainStart: i64 = issued - (TLS_TICKET_CHAIN_LIMIT - MINUTE * 30);
  const late: u8[] = sealed(key, info, stateFor(TLS_CHACHA20_POLY1305_SHA256, chainStart), issued);
  t.ok("a ticket opens 24 h after its chain started", tlsTicketOpen(key, info, late, chainStart + TLS_TICKET_CHAIN_LIMIT, out));
  t.ok("and not 1 ns later, inside its own lifetime", !tlsTicketOpen(key, info, late, chainStart + TLS_TICKET_CHAIN_LIMIT + 1, out));

  // Tickets this server never issues, sealed here because the test holds the key.
  const long: TlsTicketState = stateFor(TLS_AES_128_GCM_SHA256, issued);
  long.lifetime = 7201;
  const overLifetime: u8[] = sealed(key, info, long, issued);
  t.ok("a ticket sealed with a lifetime of 7201 s is sealed", toI32(overLifetime.length) > 0);
  t.ok("and refused at its issue time", !tlsTicketOpen(key, info, overLifetime, issued, out));
  const exact: TlsTicketState = stateFor(TLS_AES_128_GCM_SHA256, issued);
  t.ok("a chain that starts at the ticket's issue time opens", tlsTicketOpen(key, info, sealed(key, info, exact, issued), issued, out));
  const future: u8[] = sealed(key, info, stateFor(TLS_AES_128_GCM_SHA256, issued + 1), issued);
  t.ok("a chain that starts 1 ns after the ticket's issue time is refused", !tlsTicketOpen(key, info, future, issued + 1, out));
  wipe(key);
};

/** 3. The key's bounds: its windows, its cap, and when it is due. */
const keyBounds = (t: Suite): void => {
  const info = new TlsTicketKeyInfo();
  const key: Secret<u8[]> = tlsTicketKeyDraw(info, START);
  const out = new TlsTicketState();
  const state: TlsTicketState = stateFor(TLS_AES_128_GCM_SHA256, START);
  const end: i64 = START + TLS_TICKET_SEAL_WINDOW;
  t.ok("a key is not due 1 ns before 12 h", !tlsTicketKeyDue(info, end - 1));
  t.ok("and is due at 12 h", tlsTicketKeyDue(info, end));
  const lastTicket: u8[] = sealed(key, info, state, end);
  t.ok("a key seals at 12 h", toI32(lastTicket.length) > 0);
  t.eqI32("and not 1 ns after", toI32(sealed(key, info, state, end + 1).length), toI32(0));
  t.ok("its last ticket opens at 14 h, the end of its lifetime", tlsTicketOpen(key, info, lastTicket, START + TLS_TICKET_OPEN_WINDOW, out));

  // The open window alone: a fresh ticket, under a key whose draw is moved back.
  const fresh: u8[] = sealed(key, info, state, START + HOUR);
  const drawn: i64 = info.createdAt;
  info.createdAt = START + HOUR - TLS_TICKET_OPEN_WINDOW;
  t.ok("a fresh ticket opens under a key drawn 14 h ago", tlsTicketOpen(key, info, fresh, START + HOUR, out));
  info.createdAt = START + HOUR - TLS_TICKET_OPEN_WINDOW - 1;
  t.ok("and not under one drawn 14 h and 1 ns ago", !tlsTicketOpen(key, info, fresh, START + HOUR, out));
  info.createdAt = drawn;

  // The seal cap, brought forward to 2.
  const capped = new TlsTicketKeyInfo();
  capped.sealCap = 2;
  const small: Secret<u8[]> = tlsTicketKeyDraw(capped, START);
  t.ok("a key capped at 2 seals its first ticket", toI32(sealed(small, capped, state, START).length) > 0);
  t.ok("and is not yet due", !tlsTicketKeyDue(capped, START));
  t.ok("it seals its second", toI32(sealed(small, capped, state, START).length) > 0);
  t.ok("and is due at the cap", tlsTicketKeyDue(capped, START));
  t.eqI32("its third is refused", toI32(sealed(small, capped, state, START).length), toI32(0));
  t.eqI64("and not counted", capped.sealed, toI64(2));
  t.ok("a seal refused for an output too short writes nothing", tlsTicketSeal(key, info, state, START, new Array<u8>(tlsTicketSize(state) - 1)) === 0);
  wipe(small);
  wipe(key);
};

/**
 * 4. The rotation turn, run three times half an hour apart, as a program runs
 * it: `wipe(previous)`, `previous = current`, the record copied, and a fresh
 * key drawn. A ticket opens under the previous key until the turn after, and
 * not then. A root of the wipe count in `tests/wipes/tls.js`.
 */
export const ticketRotationTurns = (t: Suite): void => {
  const out = new TlsTicketState();
  const state: TlsTicketState = stateFor(TLS_CHACHA20_POLY1305_SHA256, START);
  const currentInfo = new TlsTicketKeyInfo();
  const previousInfo = new TlsTicketKeyInfo();
  let previous: Secret<u8[]> = tlsTicketKeyDraw(previousInfo, START);
  let current: Secret<u8[]> = tlsTicketKeyDraw(currentInfo, START);
  let now: i64 = START;
  let ticket: u8[] = sealed(current, currentInfo, state, now);
  let older: u8[] = [];
  for (let turn: i32 = 1; turn <= 3; turn++) {
    now = now + MINUTE * 30;
    wipe(previous);
    previous = current;
    previousInfo.copyFrom(currentInfo);
    current = tlsTicketKeyDraw(currentInfo, now);
    t.ok(`turn ${turn}: the last turn's ticket opens under the previous key`, tlsTicketOpen(previous, previousInfo, ticket, now, out));
    t.ok(`turn ${turn}: and not under the current one`, !tlsTicketOpen(current, currentInfo, ticket, now, out));
    if (turn > 1) {
      t.ok(
        `turn ${turn}: the ticket of two turns ago, inside its lifetime, opens under neither key`,
        !tlsTicketOpen(previous, previousInfo, older, now, out) && !tlsTicketOpen(current, currentInfo, older, now, out)
      );
    }
    older = ticket;
    ticket = sealed(current, currentInfo, state, now);
  }
  wipe(previous);
  wipe(current);
};

/** Two ids that start their probe chains at the same slot of `strikes`: the second found by trying values of its last byte. */
const collidingId = (strikes: TlsTicketStrikes, id: u8[]): u8[] => {
  const other: u8[] = range(id, 0, TLS_TICKET_NONCE_SIZE);
  for (let b: i32 = 0; b < 256; b++) {
    other[11] = toU8(b);
    if (toI32(other[11]) !== toI32(id[11]) && strikes.home(other) === strikes.home(id)) {
      return other;
    }
  }
  panic("no colliding id");
};

/** An id of twelve bytes, each `b`. */
const idOf = (b: i32): u8[] => {
  const id: u8[] = new Array<u8>(TLS_TICKET_NONCE_SIZE);
  id.fill(toU8(b));
  return id;
};

/** 5. The strike register. */
const strikes = (t: Suite): void => {
  const register = new TlsTicketStrikes(16);
  const a: u8[] = idOf(1);
  const expires: i64 = START + HOUR;
  t.ok("an id is taken once", register.take(a, expires, START));
  t.ok("and refused when replayed", !register.take(a, expires, START + MINUTE));
  t.ok("and at its expiry, which it is held through", !register.take(a, expires, expires));
  t.ok("and taken again 1 ns after its expiry", register.take(a, expires + HOUR, expires + 1));
  t.eqI32("in the slot it held, so it is recorded once", register.count(a), toI32(1));

  // The clamp: an expiry a week away is held one server lifetime, 7200 s.
  const b: u8[] = idOf(2);
  t.ok("an id whose ticket expires in a week is taken", register.take(b, START + HOUR * 168, START));
  t.ok("and refused 7200 s later", !register.take(b, START + HOUR * 168, START + SECOND * 7200));
  t.ok("and taken 1 ns after that", register.take(b, START + HOUR * 168, START + SECOND * 7200 + 1));
  t.ok("an id of another length than a nonce is refused", !register.take(range(idOf(3), 0, 11), expires, START));
  t.eqI64("uncounted", register.refusedFull, toI64(0));

  // A full register fails closed and counts the refusals.
  const full = new TlsTicketStrikes(2);
  t.ok("a register of 2 takes its first id", full.take(idOf(1), expires, START));
  t.ok("and its second", full.take(idOf(2), expires, START));
  t.ok("and refuses a third while both are held", !full.take(idOf(3), expires, START));
  t.ok("and a fourth", !full.take(idOf(4), expires, expires));
  t.eqI64("counting both refusals", full.refusedFull, toI64(2));
  t.ok("it takes the third once an entry has expired", full.take(idOf(3), expires + HOUR, expires + 1));
  t.eqI32("reusing the expired entry, with no more slots used", full.filled, toI32(2));
  t.eqI32("and one entry held after the other expires", full.live(expires + HOUR), toI32(1));

  // A live id behind an expired slot on its probe chain.
  const chain = new TlsTicketStrikes(8);
  const x: u8[] = idOf(5);
  const y: u8[] = collidingId(chain, x);
  t.ok("an id is taken at its home slot", chain.take(x, START + MINUTE, START));
  t.ok("and an id with the same home after it", chain.take(y, START + HOUR, START));
  t.ok("once the first has expired, the second, still held, is refused", !chain.take(y, START + HOUR, START + MINUTE * 2));
  t.eqI32("and is recorded once", chain.count(y), toI32(1));
  t.ok("while a third id takes the expired slot", chain.take(collidingId(chain, y), START + HOUR, START + MINUTE * 2));
};

/** 1–5 together: a ticket opened, then struck, so that its replay is refused. */
const resumption = (t: Suite): void => {
  const info = new TlsTicketKeyInfo();
  const key: Secret<u8[]> = tlsTicketKeyDraw(info, START);
  const register = new TlsTicketStrikes(64);
  const ticket: u8[] = sealed(key, info, stateFor(TLS_AES_128_GCM_SHA256, START), START);
  const out = new TlsTicketState();
  t.ok("a resumption opens its ticket", tlsTicketOpen(key, info, ticket, START + MINUTE, out));
  t.ok("and strikes its id", register.take(out.id, out.expiresAt(), START + MINUTE));
  t.ok("the same ticket opens again", tlsTicketOpen(key, info, ticket, START + MINUTE * 2, out));
  t.ok("but its id is struck, so the replay is refused", !register.take(out.id, out.expiresAt(), START + MINUTE * 2));
  wipe(key);
};

/** Runs every check and answers the exit code; `net_tls_ticket_f64` runs them under `--number-mode f64`. */
export const ticketChecks = (): i32 => {
  const t = new Suite("tls tickets");
  roundTrip(t, "AES-128-GCM", TLS_AES_128_GCM_SHA256);
  roundTrip(t, "AES-256-GCM", TLS_AES_256_GCM_SHA384);
  roundTrip(t, "ChaCha20-Poly1305", TLS_CHACHA20_POLY1305_SHA256);
  tampering(t);
  ticketBounds(t);
  keyBounds(t);
  ticketRotationTurns(t);
  strikes(t);
  resumption(t);
  return t.done();
};
