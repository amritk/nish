// Four guards in `std/term.ts` replaced explicit panics in WP85 S3, and no
// public input reaches the value each one stops: `KeyDecoder.keep` clamps a
// negative `used` to 0, `termDecodeKeys` and `termDecodeEvents` stop a cursor
// that stepped back below 0, and `termBytesText` clamps a count past its
// buffer. This case feeds each the inputs at the edge it guards, through the
// public API, and pins what comes out: a feed that uses none of the held
// bytes (`used` 0), a count below 0 or past the buffer, a sequence or
// character cut at the end of every read, and a text of 0 bytes. With a guard
// removed these outputs do not change; what fails is the std-panics ratchet,
// on the index site the prover can no longer discharge
// (`docs/security/term.md`, "WP85 S5").
import { Suite } from "nish/testing";
import {
  EVENT_KEY,
  EVENT_PASTE,
  KEY_CHAR,
  KEY_DOWN,
  KEY_ESCAPE,
  KEY_UP,
  KeyDecoder,
  KeyEvent,
  Screen,
  TermEvent,
} from "nish/term";
import { replaceAll } from "nish/text";

/** `s` with ESC as `^[`. */
const shown = (s: string): string => replaceAll(s, "\x1b", "^[");

/** A key kind by name: `char`, `up`, `down`, `escape`, or `other`. */
const kindName = (kind: i32): string => {
  if (kind === KEY_CHAR) {
    return "char";
  }
  if (kind === KEY_UP) {
    return "up";
  }
  if (kind === KEY_DOWN) {
    return "down";
  }
  if (kind === KEY_ESCAPE) {
    return "escape";
  }
  return "other";
};

/** The keys as `kind:code`, joined by spaces. */
const keys = (events: KeyEvent[]): string => {
  const parts: string[] = [];
  for (const e of events) {
    parts.push(`${kindName(e.kind)}:${e.code}`);
  }
  return parts.join(" ");
};

/** The events as `key kind:code` or `paste [units]` (natively, the text's UTF-8 bytes), joined by ` | `. */
const events = (list: TermEvent[]): string => {
  const parts: string[] = [];
  for (const e of list) {
    if (e.type === EVENT_KEY) {
      const mods: string = e.modifiers !== 0 ? ` m${e.modifiers}` : "";
      parts.push(`key ${kindName(e.key)}:${e.code}${mods}`);
    } else if (e.type === EVENT_PASTE) {
      const units: string[] = [];
      for (let k: i32 = 0; k < e.text.length; k++) {
        units.push(`${e.text.charCodeAt(k)}`);
      }
      parts.push(`paste [${units.join(",")}]`);
    } else {
      parts.push(`event ${e.type}`);
    }
  }
  return parts.join(" | ");
};

/** The bytes of ASCII `s`. */
const ascii = (s: string): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < s.length; k++) {
    out.push(toU8(s.charCodeAt(k)));
  }
  return out;
};

/** The bytes `codes`. */
const bytesOf = (codes: i32[]): u8[] => {
  const out: u8[] = [];
  for (const c of codes) {
    out.push(toU8(c));
  }
  return out;
};

/** `a` followed by `b`. */
const joined = (a: u8[], b: u8[]): u8[] => {
  const out: u8[] = [];
  for (const x of a) {
    out.push(x);
  }
  for (const x of b) {
    out.push(x);
  }
  return out;
};

export const main = (): number => {
  const s: Suite = new Suite("term decoder bounds");
  const none: u8[] = [];

  // KeyDecoder.keep: a feed whose decode uses none of the held bytes holds them all, on the clock they arrived by.
  const held: KeyDecoder = new KeyDecoder(toF64(50));
  s.eqStr("keep: a lone ESC is held", keys(held.feed(ascii("\x1b"), 1, toF64(0))), "");
  s.eqBool("keep: the ESC waits", held.waiting(), true);
  s.eqStr("keep: an empty read uses none of it", keys(held.feed(none, 0, toF64(30))), "");
  s.eqBool("keep: the ESC still waits", held.waiting(), true);
  s.eqStr("keep: the empty read did not restart the clock", keys(held.poll(toF64(49))), "");
  s.eqStr("keep: the ESC is given up 50 ms after it came", keys(held.poll(toF64(50))), "escape:27");
  s.eqBool("keep: nothing is held after", held.waiting(), false);

  const counts: KeyDecoder = new KeyDecoder(toF64(50));
  s.eqStr("keep: a count below 0 reads nothing", keys(counts.feed(ascii("ab"), -3, toF64(0))), "");
  s.eqBool("keep: and holds nothing", counts.waiting(), false);
  s.eqStr("keep: a count past the buffer reads the buffer", keys(counts.feed(ascii("ab"), 5, toF64(0))), "char:97 char:98");
  counts.feed(ascii("\x1b"), 1, toF64(0));
  s.eqStr("keep: a count below 0 with an ESC held uses none of it", keys(counts.feed(ascii("x"), -1, toF64(10))), "");
  s.eqStr("keep: and the ESC then goes with what follows", keys(counts.feed(ascii("[A"), 2, toF64(20))), "up:65");

  const restart: KeyDecoder = new KeyDecoder(toF64(50));
  s.eqStr("keep: feedEvents holds ESC [", events(restart.feedEvents(ascii("\x1b["), 2, toF64(0))), "");
  s.eqStr("keep: a byte more of it restarts the clock", events(restart.feedEvents(ascii("1"), 1, toF64(40))), "");
  s.eqStr("keep: not given up 50 ms after the first byte", events(restart.pollEvents(toF64(80))), "");
  s.eqStr("keep: given up 50 ms after the last", events(restart.pollEvents(toF64(90))), "key escape:27 | key char:91 | key char:49");
  s.eqStr("keep: feedEvents with an empty read and nothing held", events(restart.feedEvents(none, 0, toF64(100))), "");
  s.eqStr("keep: feedEvents with a count below 0", events(restart.feedEvents(ascii("ab"), -1, toF64(100))), "");

  // termDecodeKeys: every step moves the cursor forward, and stops at the end of the read.
  const cut: KeyDecoder = new KeyDecoder(toF64(50));
  s.eqStr("keys: a character cut after its lead byte is held", keys(cut.feed(bytesOf([97, 0xe2, 0x82]), 3, toF64(0))), "char:97");
  s.eqStr("keys: and finished by the next read", keys(cut.feed(bytesOf([0xac, 98]), 2, toF64(1))), "char:8364 char:98");
  s.eqStr("keys: a cut four-byte character is held", keys(cut.feed(bytesOf([0xf0, 0x9f]), 2, toF64(2))), "");
  s.eqStr("keys: and given up as one replacement", keys(cut.poll(toF64(60))), "char:65533");
  s.eqStr("keys: a lone continuation byte", keys(cut.feed(bytesOf([0x80, 99]), 2, toF64(70))), "char:65533 char:99");
  s.eqStr("keys: ESC O cut at the end is held", keys(cut.feed(ascii("\x1bO"), 2, toF64(80))), "");
  s.eqStr("keys: and finished by the next read", keys(cut.feed(ascii("B"), 1, toF64(81))), "down:66");
  const ones: string[] = [];
  for (let k: i32 = 0; k < 33; k++) {
    ones.push("1");
  }
  const run: string = `\x1b[${ones.join("")}`;
  const capped: KeyEvent[] = cut.feed(ascii(run + "A"), toI32(run.length) + 1, toF64(90));
  s.eqStr("keys: a CSI run past the cap is a key a byte", `${capped.length}`, `${run.length + 1}`);
  s.eqStr("keys: the ESC given up first, then what follows", keys([capped[0], capped[1], capped[2]]), "escape:27 char:91 char:49");
  s.eqBool("keys: and holds nothing", cut.waiting(), false);

  // termDecodeEvents: likewise, and a step that answers "hold" (ESC O at the end) returns where it started.
  const ev: KeyDecoder = new KeyDecoder(toF64(50));
  s.eqStr("events: ESC O cut at the end is held", events(ev.feedEvents(ascii("a\x1bO"), 3, toF64(0))), "key char:97");
  s.eqStr("events: and finished by the next read", events(ev.feedEvents(ascii("A"), 1, toF64(1))), "key up:65");
  s.eqStr("events: Alt with a key", events(ev.feedEvents(ascii("\x1bx"), 2, toF64(2))), "key char:120 m2");
  s.eqStr("events: a cut character is held", events(ev.feedEvents(bytesOf([0xc3]), 1, toF64(3))), "");
  s.eqStr("events: and given up as one replacement", events(ev.pollEvents(toF64(60))), "key char:65533");
  s.eqStr("events: a lone continuation byte", events(ev.feedEvents(bytesOf([0xbf, 100]), 2, toF64(70))), "key char:65533 | key char:100");

  // termBytesText: every count it is handed is the whole of its buffer, down to 0 bytes.
  const paste: KeyDecoder = new KeyDecoder(toF64(50));
  const open: u8[] = ascii("\x1b[200~");
  const close: u8[] = ascii("\x1b[201~");
  const empty: u8[] = joined(open, close);
  s.eqStr("text: an empty paste", events(paste.feedEvents(empty, toI32(empty.length), toF64(0))), 'paste []');
  const accent: u8[] = joined(joined(open, bytesOf([0xc3, 0xa9])), close);
  s.eqStr("text: a paste of é is its two bytes", events(paste.feedEvents(accent, toI32(accent.length), toF64(1))), 'paste [195,169]');
  const cutPaste: u8[] = joined(joined(open, bytesOf([104, 0xe2, 0x82])), close);
  s.eqStr("text: a paste whose last character is cut keeps the bytes that came", events(paste.feedEvents(cutPaste, toI32(cutPaste.length), toF64(2))), 'paste [104,226,130]');
  const screen: Screen = new Screen(2, 1, false);
  screen.flush();
  s.eqStr("text: a flush with nothing changed is 0 bytes", shown(screen.flush()), "");
  return s.done();
};
