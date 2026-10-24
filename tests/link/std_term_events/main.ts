// `nish/term`'s event stream: `KeyDecoder.feedEvents` and `pollEvents` turn
// the bytes a terminal sends into `TermEvent`s, and `KeyState` turns those
// into which keys are down. Every form is fed whole, split at every byte into
// two reads, and one byte per read, and must come out the same each way; the
// replies a terminal sends to a query come out as replies and never as keys.
// An event prints as one short line (`key kind:code m<mods> a<action>`,
// `mouse b<button> a<action> x,y`, `reply introducer/prefix/intermediate/final
// p[params]`), ESC as `^[`. `args` denies every capability, as std_term's do.
import { Suite } from "nish/testing";
import {
  ACTION_PRESS,
  ACTION_RELEASE,
  EVENT_FOCUS,
  EVENT_KEY,
  EVENT_MOUSE,
  EVENT_PASTE,
  EVENT_QUIT,
  KEY_CHAR,
  KEY_UP,
  KeyDecoder,
  KeyState,
  TermEvent,
} from "nish/term";
import { replaceAll } from "nish/text";

/** `s` with ESC as `^[` and a line feed as `\n`. */
const shown = (s: string): string => replaceAll(replaceAll(s, "\x1b", "^["), "\n", "\\n");

const listed = (values: i32[]): string => {
  const parts: string[] = [];
  for (const v of values) {
    parts.push(`${v}`);
  }
  return `[${parts.join(",")}]`;
};

/** One event as a line. */
const line = (e: TermEvent): string => {
  const mods: string = e.modifiers !== 0 ? ` m${e.modifiers}` : "";
  const text: string = e.text !== "" ? ` "${shown(e.text)}"` : "";
  const params: string = e.params.length > 0 ? ` p${listed(e.params)}` : "";
  if (e.type === EVENT_KEY) {
    const action: string = e.action !== ACTION_PRESS ? ` a${e.action}` : "";
    return `key ${e.key}:${e.code}${mods}${action}${text}${params}`;
  }
  if (e.type === EVENT_MOUSE) {
    const pixels: string = e.px >= 0 ? ` px${e.px},${e.py}` : "";
    return `mouse b${e.button} a${e.action} ${e.x},${e.y}${mods}${pixels}`;
  }
  if (e.type === EVENT_PASTE) {
    return `paste "${shown(e.text)}"`;
  }
  if (e.type === EVENT_FOCUS) {
    return e.gained ? "focus in" : "focus out";
  }
  if (e.type === EVENT_QUIT) {
    return "quit";
  }
  return `reply ${e.introducer}/${e.prefix}/${e.intermediate}/${e.reply}${params}${text}`;
};

/** The events, one line each, joined by ` | `. */
const lines = (events: TermEvent[]): string => {
  const parts: string[] = [];
  for (const e of events) {
    parts.push(line(e));
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

/** `bytes[from, to)`. */
const part = (bytes: u8[], from: i32, to: i32): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = from; k < to; k++) {
    out.push(bytes[k]);
  }
  return out;
};

const append = (into: TermEvent[], events: TermEvent[]): void => {
  for (const e of events) {
    into.push(e);
  }
};

/** A 50 ms decoder set up as `like` is: its CPRs awaited, pixel mouse and cell size. */
const fresh = (like: KeyDecoder): KeyDecoder => {
  const d: KeyDecoder = new KeyDecoder(toF64(50));
  d.cprOutstanding = like.cprOutstanding;
  d.pixelMouse = like.pixelMouse;
  d.cellWidthPx = like.cellWidthPx;
  d.cellHeightPx = like.cellHeightPx;
  return d;
};

/**
 * Check that `bytes` decode to `expected` fed whole, split into two reads at
 * every byte (1 ms apart), and one byte per read (1 ms apart), each followed
 * by a poll once the timeout has passed.
 */
const check = (s: Suite, name: string, like: KeyDecoder, bytes: u8[], expected: string): void => {
  const n: i32 = bytes.length;
  const d: KeyDecoder = fresh(like);
  const whole: TermEvent[] = d.feedEvents(bytes, n, toF64(0));
  append(whole, d.pollEvents(toF64(1000)));
  s.eqStr(`${name}: whole`, lines(whole), expected);
  let split: string = expected;
  for (let k: i32 = 1; k < n && split === expected; k++) {
    const e: KeyDecoder = fresh(like);
    const got: TermEvent[] = e.feedEvents(part(bytes, 0, k), k, toF64(0));
    append(got, e.feedEvents(part(bytes, k, n), n - k, toF64(1)));
    append(got, e.pollEvents(toF64(1000)));
    if (lines(got) !== expected) {
      split = `split at ${k}: ${lines(got)}`;
    }
  }
  s.eqStr(`${name}: split at every byte`, split, expected);
  const f: KeyDecoder = fresh(like);
  const each: TermEvent[] = [];
  for (let k: i32 = 0; k < n; k++) {
    append(each, f.feedEvents(part(bytes, k, k + 1), 1, toF64(k)));
  }
  append(each, f.pollEvents(toF64(n) + toF64(1000)));
  s.eqStr(`${name}: a byte a read`, lines(each), expected);
};

/** The events `s` makes fed whole to a fresh decoder. */
const decode = (s: string): TermEvent[] => {
  const d: KeyDecoder = new KeyDecoder(toF64(50));
  const bytes: u8[] = ascii(s);
  return d.feedEvents(bytes, bytes.length, toF64(0));
};

/** How many of `events` have action `action`. */
const actions = (events: TermEvent[], action: i32): i32 => {
  let n: i32 = 0;
  for (let k: i32 = 0; k < toI32(events.length); k++) {
    if (events[k].type === EVENT_KEY && events[k].action === action) {
      n = n + 1;
    }
  }
  return n;
};

/** How many key events X11's defaults generate in `(from, to]` for `a` held from 0 to `up`: the press at 0, a repeat at 660 ms and every 40 ms after. */
const generated = (from: i32, to: i32, up: i32): i32 => {
  let n: i32 = 0;
  for (let g: i32 = from + 1; g <= to && g < up; g++) {
    if (g === 0 || (g >= 660 && (g - 660) % 40 === 0)) {
      n = n + 1;
    }
  }
  return n;
};

/**
 * `a` held from 0 to `up` under X11's defaults, read at each time in `reads`
 * and then every `then` ms to `up + 3000`. Each read carries every event
 * generated since the last. The program ticks every 16 ms and sends a query
 * after each tick; a read up to `ackUntil` answers the last one sent, which it
 * passes to `delivered`. Gives "presses/releases" made while `a` was down,
 * then how long after `up` it was let go, or "never".
 */
const hold = (reads: i32[], then: i32, up: i32, ackUntil: i32): string => {
  const keys: KeyState = new KeyState();
  let presses: i32 = 0;
  let early: i32 = 0;
  let late: i32 = -1;
  let listed: i32 = 0;
  let last: i32 = -1;
  for (let t: i32 = 0; t <= up + 3000; t++) {
    const got: TermEvent[] = t % 16 === 0 ? keys.tick(toF64(t)) : [];
    const read: boolean = listed < toI32(reads.length) ? reads[listed] === t : t > last && (t - last) % then === 0;
    if (read) {
      listed = listed + 1;
      let bytes: string = "";
      for (let k: i32 = generated(last, t, up); k > 0; k--) {
        bytes = bytes + "a";
      }
      append(got, keys.apply(decode(bytes), toF64(t)));
      if (t <= ackUntil) {
        keys.delivered(toF64(t - (t % 16)));
      }
      last = t;
    }
    presses = presses + actions(got, ACTION_PRESS);
    if (actions(got, ACTION_RELEASE) > 0) {
      if (t < up) {
        early = early + actions(got, ACTION_RELEASE);
      } else if (late < 0) {
        late = t - up;
      }
    }
  }
  return `${presses}/${early} then ${late < 0 ? "never" : `${late} ms`}`;
};

export const main = (): i32 => {
  const s: Suite = new Suite("term events");
  const plain: KeyDecoder = new KeyDecoder(toF64(50));

  // --- legacy keys (xterm ctlseqs, "PC-Style Function Keys") ---------------
  check(s, "a letter", plain, ascii("a"), "key 1:97");
  check(s, "the up arrow", plain, ascii("\x1b[A"), "key 2:65");
  check(s, "Ctrl-up", plain, ascii("\x1b[1;5A"), "key 2:65 m4");
  check(s, "an SS3 F1", plain, ascii("\x1bOP"), "key 14:80");
  check(s, "keypad Enter", plain, ascii("\x1bOM"), "key 6:13");
  check(s, "Delete", plain, ascii("\x1b[3~"), "key 31:126");
  check(s, "Shift-F5", plain, ascii("\x1b[15;2~"), "key 18:126 m1");
  check(s, "Home, Insert, Page Up, Page Down, End, F12", plain, ascii("\x1b[1~\x1b[2~\x1b[5~\x1b[6~\x1b[8~\x1b[24~"), "key 26:126 | key 30:126 | key 28:126 | key 29:126 | key 27:126 | key 25:126");
  check(s, "F6 and F11", plain, ascii("\x1b[17~\x1b[23~"), "key 19:126 | key 24:126");
  check(s, "Home and End as 7~ and 4~", plain, ascii("\x1b[7~\x1b[4~"), "key 26:126 | key 27:126");
  check(s, "F4 as 14~, F7 to F10", plain, ascii("\x1b[14~\x1b[18~\x1b[19~\x1b[20~\x1b[21~"), "key 17:126 | key 20:126 | key 21:126 | key 22:126 | key 23:126");
  check(s, "Ctrl-Home, Ctrl-End, Shift-F2, Shift-F4", plain, ascii("\x1b[1;5H\x1b[1;5F\x1b[1;2Q\x1b[1;2S"), "key 26:72 m4 | key 27:70 m4 | key 15:81 m1 | key 17:83 m1");
  check(s, "SS3 Home, End, F2, F4", plain, ascii("\x1bOH\x1bOF\x1bOQ\x1bOS"), "key 26:72 | key 27:70 | key 15:81 | key 17:83");
  check(s, "Shift-Tab", plain, ascii("\x1b[Z"), "key 10:9 m1");
  check(s, "the Linux console's F1", plain, ascii("\x1b[[A"), "key 14:65");
  check(s, "the Linux console's F2 to F5", plain, ascii("\x1b[[B\x1b[[C\x1b[[D\x1b[[E"), "key 15:66 | key 16:67 | key 17:68 | key 18:69");
  check(s, "an unknown Linux console key", plain, ascii("\x1b[[Z"), "key 13:91 | key 1:90");
  check(s, "Alt-x", plain, ascii("\x1bx"), "key 1:120 m2");
  check(s, "Alt-Backspace", plain, ascii("\x1b\x7f"), "key 11:127 m2");
  check(s, "ESC then the up arrow", plain, ascii("\x1b\x1b[A"), "key 8:27 | key 2:65");
  check(s, "a lone ESC", plain, ascii("\x1b"), "key 8:27");
  check(s, "ESC O given up", plain, ascii("\x1bO"), "key 8:27 | key 1:79");
  check(s, "a broken CSI", plain, ascii("\x1b[1\x01"), "key 8:27 | key 1:91 | key 1:49 | key 12:1");
  check(s, "an unknown CSI", plain, ascii("\x1b[5;3X"), "key 13:88 m2 p[5,3]");
  check(s, "UTF-8", plain, bytesOf([195, 169]), "key 1:233");
  check(s, "broken UTF-8", plain, bytesOf([195, 65]), "key 1:65533 | key 1:65");
  check(s, "UTF-8 cut off", plain, bytesOf([226, 130]), "key 1:65533");

  // --- kitty keyboard protocol and modifyOtherKeys ------------------------
  check(s, "kitty Ctrl-a", plain, ascii("\x1b[97;5u"), "key 1:97 m4");
  check(s, "kitty a released", plain, ascii("\x1b[97;1:3u"), "key 1:97 a3");
  check(s, "kitty Shift-a repeating, with its text", plain, ascii("\x1b[97;2:2;65u"), "key 1:97 m1 a2 \"A\"");
  check(s, "kitty text of two code points", plain, ascii("\x1b[97;;104:105u"), "key 1:97 \"hi\"");
  check(s, "kitty text past ASCII", plain, ascii("\x1b[233;;233u"), "key 1:233 \"é\"");
  check(s, "kitty text that is no scalar value", plain, ascii("\x1b[97;;55296u"), "key 1:97 \"�\"");
  check(s, "kitty Enter, Tab, Backspace, Escape, Space", plain, ascii("\x1b[13u\x1b[9u\x1b[127u\x1b[27u\x1b[32u"), "key 6:13 | key 10:9 | key 11:127 | key 8:27 | key 7:32");
  check(s, "kitty code 1 with Ctrl, a control", plain, ascii("\x1b[1;5u"), "key 12:1 m4");
  check(s, "kitty left Shift", plain, ascii("\x1b[57441;2u"), "key 13:57441 m1");
  check(s, "kitty Up released", plain, ascii("\x1b[1;1:3A"), "key 2:65 a3");
  check(s, "kitty F3 as 13~", plain, ascii("\x1b[13~"), "key 16:126");
  check(s, "modifyOtherKeys Ctrl-i", plain, ascii("\x1b[27;5;105~"), "key 1:105 m4");

  // --- SGR mouse (xterm ctlseqs, "Mouse Tracking", 1006 and 1016) ----------
  check(s, "a left press", plain, ascii("\x1b[<0;10;5M"), "mouse b1 a1 9,4");
  check(s, "a right release", plain, ascii("\x1b[<2;10;5m"), "mouse b3 a3 9,4");
  check(s, "a move with no button", plain, ascii("\x1b[<35;1;1M"), "mouse b0 a4 0,0");
  check(s, "the wheel down", plain, ascii("\x1b[<65;3;3M"), "mouse b5 a1 2,2");
  check(s, "a Ctrl-left press", plain, ascii("\x1b[<16;2;2M"), "mouse b1 a1 1,1 m4");
  check(s, "a Shift-Alt-left press", plain, ascii("\x1b[<12;1;1M"), "mouse b1 a1 0,0 m3");
  check(s, "button 8", plain, ascii("\x1b[<128;1;1M"), "mouse b8 a1 0,0");
  const pixels: KeyDecoder = new KeyDecoder(toF64(50));
  pixels.pixelMouse = true;
  check(s, "a pixel press, cell size unknown", pixels, ascii("\x1b[<0;81;33M"), "mouse b1 a1 -1,-1 px80,32");
  pixels.cellWidthPx = 8;
  pixels.cellHeightPx = 16;
  check(s, "a pixel press, 8x16 cells", pixels, ascii("\x1b[<0;81;33M"), "mouse b1 a1 10,2 px80,32");

  // --- bracketed paste and focus -------------------------------------------
  check(s, "a paste with ESC and a newline", plain, ascii("\x1b[200~hi\x1b[A\nthere\x1b[201~q"), "paste \"hi^[[A\\nthere\" | key 1:113");
  check(s, "a paste with half a terminator", plain, ascii("\x1b[200~a\x1b[20x\x1b[201~"), "paste \"a^[[20x\"");
  check(s, "an empty paste", plain, ascii("\x1b[200~\x1b[201~"), "paste \"\"");
  check(s, "a stray paste end", plain, ascii("\x1b[201~b"), "key 1:98");
  check(s, "focus", plain, ascii("\x1b[I\x1b[O"), "focus in | focus out");

  // --- terminal replies, never keys -----------------------------------------
  check(
    s,
    "replies among keys",
    plain,
    ascii("a\x1b[?62;22cb\x1b[0n\x1b[?1u\x1b[?2026;2$y\x1b[4;600;800t\x1bP>|kitty(0.35)\x1b\\\x1b]11;rgb:0000/0000/0000\x07\x1b_Gi=1;OK\x1b\\\x1bP1$r0m\x1b\\\x1b^pm\x1b\\c"),
    "key 1:97 | reply 91/63/0/99 p[62,22] | key 1:98 | reply 91/0/0/110 p[0] | reply 91/63/0/117 p[1] | reply 91/63/36/121 p[2026,2] | reply 91/0/0/116 p[4,600,800] | reply 80/62/0/124 \"kitty(0.35)\" | reply 93/0/0/0 p[11] \"rgb:0000/0000/0000\" | reply 95/0/0/71 \"i=1;OK\" | reply 80/0/36/114 p[1] \"0m\" | reply 94/0/0/0 \"pm\" | key 1:99",
  );
  check(s, "a DA2 reply", plain, ascii("\x1b[>1;4000;29c"), "reply 91/62/0/99 p[1,4000,29]");
  check(s, "an XTSMGRAPHICS reply", plain, ascii("\x1b[?1;0;256S"), "reply 91/63/0/83 p[1,0,256]");
  check(s, "an R with no CPR awaited is F3", plain, ascii("\x1b[1;2R"), "key 16:82 m1");
  const cpr: KeyDecoder = new KeyDecoder(toF64(50));
  cpr.cprOutstanding = 1;
  check(s, "a CPR awaited, then F3", cpr, ascii("\x1b[12;40R\x1b[1;2R"), "reply 91/0/0/82 p[12,40] | key 16:82 m1");
  const counted: KeyDecoder = fresh(cpr);
  counted.feedEvents(ascii("\x1b[12;40R"), 8, toF64(0));
  s.eqI32("a CPR takes one off cprOutstanding", counted.cprOutstanding, 0);
  check(s, "an OSC broken off by a key", plain, ascii("\x1b]11;x\x1b[A"), "key 2:65");

  // A reply that arrives in pieces, each within the timeout of the last but
  // all of it over the timeout, is still one reply.
  const slow: KeyDecoder = new KeyDecoder(toF64(50));
  const pieces: TermEvent[] = slow.feedEvents(ascii("\x1bP>|ki"), 6, toF64(0));
  append(pieces, slow.feedEvents(ascii("tt"), 2, toF64(40)));
  append(pieces, slow.feedEvents(ascii("y\x1b\\"), 3, toF64(80)));
  s.eqStr("a DCS over three reads 40 ms apart", lines(pieces), "reply 80/62/0/124 \"kitty\"");

  // An unterminated string is dropped whole at the timeout.
  const cut: KeyDecoder = new KeyDecoder(toF64(50));
  const dropped: TermEvent[] = cut.feedEvents(ascii("\x1b]11;rgb"), 8, toF64(0));
  append(dropped, cut.pollEvents(toF64(100)));
  s.eqStr("an unterminated OSC is dropped at the timeout", lines(dropped), "");
  s.eqBool("nothing is held after it", cut.waiting(), false);
  s.eqStr("the next key comes through", lines(cut.feedEvents(ascii("z"), 1, toF64(200))), "key 1:122");

  // An ESC whose next bytes come after the timeout is an ESC, and they are keys.
  const late: KeyDecoder = new KeyDecoder(toF64(50));
  const parted: TermEvent[] = late.feedEvents(ascii("\x1b"), 1, toF64(0));
  append(parted, late.feedEvents(ascii("[A"), 2, toF64(100)));
  s.eqStr("ESC, then [A 100 ms later", lines(parted), "key 8:27 | key 1:91 | key 1:65");

  // A paste waits for its end however long it takes.
  const paste: KeyDecoder = new KeyDecoder(toF64(50));
  const pasted: TermEvent[] = paste.feedEvents(ascii("\x1b[200~ab"), 8, toF64(0));
  append(pasted, paste.pollEvents(toF64(1000)));
  append(pasted, paste.feedEvents(ascii("c\x1b[201~"), 7, toF64(2000)));
  s.eqStr("a paste is never timed out", lines(pasted), "paste \"abc\"");

  // --- KeyState --------------------------------------------------------------
  const keys: KeyState = new KeyState();
  s.eqStr("a press passes through", lines(keys.apply(decode("a"), toF64(0))), "key 1:97");
  s.eqBool("a is down", keys.isDown(KEY_CHAR, 97), true);
  s.eqBool("A is the same key", keys.isDown(KEY_CHAR, 65), true);
  s.eqStr("the press again is a repeat", lines(keys.apply(decode("a"), toF64(300))), "key 1:97 a2");
  s.eqStr("under releaseGapMs after the repeat, nothing", lines(keys.tick(toF64(399))), "");
  s.eqStr("releaseGapMs after the repeat, a release", lines(keys.tick(toF64(400))), "key 1:97 a3");
  s.eqBool("a is up", keys.isDown(KEY_CHAR, 97), false);
  keys.apply(decode("B"), toF64(1000));
  s.eqStr("a tap: under firstRepeatMs, nothing", lines(keys.tick(toF64(1699))), "");
  s.eqStr("a tap: firstRepeatMs after it, a release with the press's code", lines(keys.tick(toF64(1700))), "key 1:66 a3");
  keys.apply(decode("a"), toF64(2000));
  s.eqStr("releases due come before the events", lines(keys.apply(decode("\x1b[A"), toF64(2700))), "key 1:97 a3 | key 2:65");
  s.eqBool("up is down, whatever the code", keys.isDown(KEY_UP, 0), true);

  // Repeats that wait in a read longer than releaseGapMs keep the key down.
  const burst: KeyState = new KeyState();
  burst.apply(decode("a"), toF64(0));
  burst.apply(decode("a"), toF64(50));
  s.eqStr("repeats read 200 ms after the last are repeats", lines(burst.apply(decode("aa"), toF64(250))), "key 1:97 a2 | key 1:97 a2");
  s.eqBool("a is still down", burst.isDown(KEY_CHAR, 97), true);
  s.eqStr("under releaseGapMs after them, nothing", lines(burst.tick(toF64(349))), "");
  s.eqStr("with no repeat for releaseGapMs, a release", lines(burst.tick(toF64(350))), "key 1:97 a3");
  burst.apply(decode("\x1b[97;3u"), toF64(1000));
  s.eqStr("a release carries the press's modifiers", lines(burst.tick(toF64(1700))), "key 1:97 m2 a3");

  // Measured against acks, a held key stays down however its input arrives:
  // one press, no release while it is down, and one release soon after.
  const start: i32[] = [0];
  s.eqStr("acked, read every 20 ms (the first repeat at 660)", hold(start, 20, 2000, 99999), "1/0 then 96 ms");
  s.eqStr("acked, reads 200 ms apart (B1)", hold(start, 200, 2000, 99999), "1/0 then 208 ms");
  s.eqStr("acked, reads 150 ms apart, ticks between (B2)", hold(start, 150, 2000, 99999), "1/0 then 256 ms");
  s.eqStr("acked, reads 250 ms apart, ticks between (B2)", hold(start, 250, 2000, 99999), "1/0 then 256 ms");
  s.eqStr("acked, reads 350 ms apart", hold(start, 350, 2000, 99999), "1/0 then 464 ms");
  const stall: i32[] = [0, 700, 740, 780, 5800];
  s.eqStr("acked, a 5 s stall mid-hold, then let go promptly (B4)", hold(stall, 20, 7000, 99999), "1/0 then 104 ms");
  const jitter: i32[] = [0, 250, 500, 650, 900];
  s.eqStr("acked, the first repeat read at 900 after bursts without it (B5)", hold(jitter, 250, 2000, 99999), "1/0 then 416 ms");
  s.eqStr("acked, a tap comes up once the watermark passes firstRepeatMs (B3)", hold(start, 20, 1, 99999), "1/0 then 735 ms");
  s.eqStr("acks stop: no release, no backstop", hold(start, 20, 2000, 1000), "1/0 then never");
  s.eqStr("without acks, read every 20 ms: held, then let go", hold(start, 20, 2000, -1), "1/0 then 80 ms");
  s.eqStr("without acks, reads 150 ms apart flicker", hold(start, 150, 2000, -1), "11/9 then 64 ms");

  // The watermark only moves forward, and clearing `watermarked` falls back to the clock.
  const acked: KeyState = new KeyState();
  acked.apply(decode("a"), toF64(0));
  acked.apply(decode("a"), toF64(700));
  acked.delivered(toF64(800));
  acked.delivered(toF64(500));
  s.eqF64("an older ack leaves the watermark", acked.watermarkMs, toF64(800));
  s.eqStr("past it by releaseGapMs, a release on the next tick", lines(acked.tick(toF64(801))), "key 1:97 a3");
  acked.apply(decode("b"), toF64(1000));
  s.eqStr("an hour on with no ack, still down", lines(acked.tick(toF64(3600000))), "");
  acked.watermarked = false;
  s.eqStr("cleared, the clock lets it go", lines(acked.tick(toF64(3600000))), "key 1:98 a3");
  s.eqF64("no watermark, no age", acked.deliveredAgoMs(toF64(5)), toF64(-1));
  acked.delivered(toF64(900));
  s.eqF64("its age is how long ago the answered query was sent", acked.deliveredAgoMs(toF64(1250)), toF64(350));

  // A non-finite time is ignored, so it cannot stick the watermark or a key.
  const zero: f64 = toF64(0);
  const nan: f64 = zero / zero;
  const inf: f64 = toF64(1) / zero;
  const odd: KeyState = new KeyState();
  odd.delivered(nan);
  s.eqBool("a NaN ack sets no watermark", odd.watermarked, false);
  odd.delivered(toF64(100));
  odd.delivered(inf);
  odd.delivered(nan);
  s.eqF64("nor moves one", odd.watermarkMs, toF64(100));
  odd.apply(decode("a"), toF64(0));
  odd.apply(decode("a"), toF64(50));
  s.eqStr("a NaN tick releases nothing", lines(odd.tick(nan)), "");
  s.eqStr("a press at NaN is a repeat", lines(odd.apply(decode("a"), nan)), "key 1:97 a2");
  s.eqStr("and keeps the key's time", lines(odd.apply(decode("b"), inf)), "key 1:98");
  odd.delivered(toF64(150));
  s.eqStr("a new key at infinity is timed from the watermark", lines(odd.tick(toF64(0))), "key 1:97 a3");
  odd.delivered(toF64(800));
  s.eqStr("and comes up firstRepeatMs after it", lines(odd.tick(toF64(0))), "key 1:98 a3");

  const real: KeyState = new KeyState();
  real.apply(decode("\x1b[97u\x1b[99u"), toF64(0));
  s.eqStr("a real release", lines(real.apply(decode("\x1b[97;1:3u"), toF64(10))), "key 1:97 a3");
  s.eqBool("releases are real from then on", real.releasesAreSynthetic, false);
  s.eqStr("and none are made up", lines(real.tick(toF64(5000))), "");
  s.eqBool("c is still down", real.isDown(KEY_CHAR, 99), true);
  s.eqStr("a press again stays a press", lines(real.apply(decode("\x1b[99u"), toF64(6000))), "key 1:99");
  s.eqStr("a release of a key not down is dropped", lines(real.apply(decode("\x1b[97;1:3u"), toF64(6010))), "");

  // A real release that comes after its key was made up as released is not reported twice.
  const twice: KeyState = new KeyState();
  twice.apply(decode("a"), toF64(0));
  s.eqStr("made up from silence", lines(twice.tick(toF64(700))), "key 1:97 a3");
  s.eqStr("the real release then is dropped", lines(twice.apply(decode("\x1b[97;1:3u"), toF64(710))), "");
  s.eqBool("but still makes releases real", twice.releasesAreSynthetic, false);

  const focus: KeyState = new KeyState();
  focus.apply(decode("xy"), toF64(0));
  s.eqStr("losing focus lets every key go", lines(focus.apply(decode("\x1b[O"), toF64(10))), "key 1:120 a3 | key 1:121 a3 | focus out");
  s.eqBool("x is up", focus.isDown(KEY_CHAR, 120), false);

  const quit: KeyState = new KeyState();
  s.eqStr("Ctrl-C is a quit", lines(quit.apply(decode("\x03"), toF64(0))), "quit");
  s.eqStr("kitty Ctrl-c is a quit", lines(quit.apply(decode("\x1b[99;5u"), toF64(0))), "quit");
  s.eqStr("kitty Ctrl-c with Num Lock on is a quit", lines(quit.apply(decode("\x1b[99;133u"), toF64(0))), "quit");
  s.eqStr("its repeat and release are dropped", lines(quit.apply(decode("\x1b[99;5:2u\x1b[99;5:3u"), toF64(0))), "");
  quit.quitOnCtrlC = false;
  s.eqStr("without quitOnCtrlC, Ctrl-C is a key", lines(quit.apply(decode("\x03"), toF64(0))), "key 9:3");
  return s.done();
};
