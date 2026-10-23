// `nish/term`: frames become escape strings and bytes become key events, with
// no I/O in between, so every line here is a pure function of what was drawn
// or fed. ESC prints as `^[` so the goldens read as the escapes they are; the
// canvas lines keep their half blocks raw, so the run under Node
// (tests/run.js, "nish/term prints the same bytes") also proves the UTF-8 the
// screen builds is byte for byte the native one. `args` denies every
// capability, so the build itself is the proof that the module reaches none.
import {
  ATTR_BOLD,
  ATTR_INVERSE,
  ATTR_NONE,
  COLOR_DEFAULT,
  Canvas,
  FixedStep,
  KEY_BACKSPACE,
  KEY_CHAR,
  KEY_CONTROL,
  KEY_CTRL_C,
  KEY_DOWN,
  KEY_ENTER,
  KEY_ESCAPE,
  KEY_LEFT,
  KEY_RIGHT,
  KEY_SPACE,
  KEY_TAB,
  KEY_UP,
  KeyDecoder,
  KeyEvent,
  Screen,
  beginSync,
  clearScreen,
  endSync,
  enterAltScreen,
  hideCursor,
  leaveAltScreen,
  moveCursor,
  paletteIndex,
  resetStyle,
  rgb,
  showCursor,
} from "nish/term";
import { replaceAll } from "nish/text";

/** `s` with each ESC spelled `^[`. */
const shown = (s: string): string => replaceAll(s, "\x1b", "^[");

const frame = (label: string, s: string): void => {
  console.log(`${label}: ${shown(s)}`);
};

/** The bytes `codes`, as a terminal would send them. */
const bytesOf = (codes: i32[]): u8[] => {
  const out: u8[] = [];
  for (const c of codes) {
    out.push(toU8(c));
  }
  return out;
};

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
  if (kind === KEY_RIGHT) {
    return "right";
  }
  if (kind === KEY_LEFT) {
    return "left";
  }
  if (kind === KEY_ENTER) {
    return "enter";
  }
  if (kind === KEY_SPACE) {
    return "space";
  }
  if (kind === KEY_ESCAPE) {
    return "escape";
  }
  if (kind === KEY_CTRL_C) {
    return "ctrl-c";
  }
  if (kind === KEY_TAB) {
    return "tab";
  }
  if (kind === KEY_BACKSPACE) {
    return "backspace";
  }
  if (kind === KEY_CONTROL) {
    return "control";
  }
  return "unknown";
};

const events = (label: string, keys: KeyEvent[], d: KeyDecoder): void => {
  const parts: string[] = [];
  for (const k of keys) {
    parts.push(`${kindName(k.kind)}(${k.code})`);
  }
  console.log(`${label}: [${parts.join(" ")}]${d.waiting() ? " holding" : ""}`);
};

export const main = (): number => {
  // --- escapes -------------------------------------------------------------
  frame("enter", enterAltScreen());
  frame("leave", leaveAltScreen());
  frame("hide", hideCursor());
  frame("show", showCursor());
  frame("clear", clearScreen());
  frame("reset", resetStyle());
  frame("move 3,1", moveCursor(3, 1));
  frame("sync", `${beginSync()}..${endSync()}`);

  // --- colour --------------------------------------------------------------
  console.log(`rgb clamps: ${rgb(300, -4, 128) === rgb(255, 0, 128)}`);
  console.log(`palette red ${paletteIndex(rgb(255, 0, 0))} grey ${paletteIndex(rgb(128, 128, 128))} near-black ${paletteIndex(rgb(8, 8, 8))} white ${paletteIndex(rgb(255, 255, 255))} default ${paletteIndex(COLOR_DEFAULT)}`);

  // --- screen: first frame, an unchanged frame, single cells ---------------
  const s = new Screen(4, 2, false);
  frame("blank 4x2", s.flush());
  console.log(`unchanged: ${s.flush().length}`);
  s.set(2, 1, 88, COLOR_DEFAULT, COLOR_DEFAULT, ATTR_NONE);
  frame("one cell", s.flush());
  s.set(0, 0, 65, COLOR_DEFAULT, COLOR_DEFAULT, ATTR_NONE);
  s.set(2, 0, 66, COLOR_DEFAULT, COLOR_DEFAULT, ATTR_NONE);
  frame("gap of one, bridged", s.flush());
  s.set(0, 0, 67, COLOR_DEFAULT, COLOR_DEFAULT, ATTR_NONE);
  s.set(3, 0, 68, rgb(255, 0, 0), COLOR_DEFAULT, ATTR_NONE);
  frame("gap of two in another style, moved", s.flush());
  s.set(0, 1, 69, COLOR_DEFAULT, COLOR_DEFAULT, ATTR_NONE);
  s.set(0, 0, 32, COLOR_DEFAULT, COLOR_DEFAULT, ATTR_NONE);
  frame("row start, then home", s.flush());
  s.set(9, 9, 90, COLOR_DEFAULT, COLOR_DEFAULT, ATTR_NONE);
  s.set(-1, 0, 90, COLOR_DEFAULT, COLOR_DEFAULT, ATTR_NONE);
  console.log(`off screen: ${s.flush().length}`);

  // --- styles: a run shares one SGR, attributes turn off with a reset ------
  const t = new Screen(6, 1, false);
  t.flush();
  const red = rgb(255, 0, 0);
  const blue = rgb(0, 0, 255);
  const drawn = t.text(0, 0, "Hi", red, blue, ATTR_BOLD);
  t.text(drawn, 0, "yo", red, blue, ATTR_INVERSE);
  t.text(4, 0, "é!", COLOR_DEFAULT, COLOR_DEFAULT, ATTR_NONE);
  frame("styled run", t.flush());
  console.log(`text answers ${drawn}, glyph at 4 is ${t.glyphAt(4, 0)}`);
  t.text(0, 0, "Hi", red, blue, ATTR_BOLD | ATTR_INVERSE);
  frame("add inverse", t.flush());
  t.clear(COLOR_DEFAULT);
  frame("cleared", t.flush());

  // --- what a cell cannot hold: unknown attribute bits are dropped, so the
  // cell needs no SGR; a control, a negative or a surrogate is U+FFFD; and a
  // gap over a control glyph is moved across, not reprinted ---------------
  const q = new Screen(4, 1, false);
  q.flush();
  q.set(0, 0, 65, COLOR_DEFAULT, COLOR_DEFAULT, 64);
  frame("unknown attribute bits", q.flush());
  q.set(0, 0, 7, COLOR_DEFAULT, COLOR_DEFAULT, ATTR_NONE);
  q.set(1, 0, -5, COLOR_DEFAULT, COLOR_DEFAULT, ATTR_NONE);
  q.set(2, 0, 55296, COLOR_DEFAULT, COLOR_DEFAULT, ATTR_NONE);
  q.set(3, 0, 127, COLOR_DEFAULT, COLOR_DEFAULT, ATTR_NONE);
  frame("control, negative, surrogate, DEL", q.flush());
  q.set(0, 0, 65, COLOR_DEFAULT, COLOR_DEFAULT, ATTR_NONE);
  q.set(2, 0, 66, COLOR_DEFAULT, COLOR_DEFAULT, ATTR_NONE);
  frame("gap over a control, moved", q.flush());

  // --- the 256-colour fallback ---------------------------------------------
  const p = new Screen(3, 1, true);
  p.text(0, 0, "ab", rgb(255, 0, 0), rgb(0, 0, 0), ATTR_NONE);
  frame("256 colours", p.flush());

  // --- synchronized output: a frame that changes is wrapped, one that does
  // not stays empty, and a style left on is reset inside the wrap ----------
  const y = new Screen(3, 1, false);
  y.sync = true;
  frame("sync first frame", y.flush());
  console.log(`sync unchanged: ${y.flush().length}`);
  y.set(1, 0, 90, red, COLOR_DEFAULT, ATTR_NONE);
  frame("sync one styled cell", y.flush());
  y.sync = false;
  y.set(1, 0, 89, COLOR_DEFAULT, COLOR_DEFAULT, ATTR_NONE);
  frame("sync turned off", y.flush());

  // --- canvas: two pixels per cell -----------------------------------------
  const cs = new Screen(4, 2, false);
  const c = new Canvas(cs);
  console.log(`canvas ${c.width}x${c.height}`);
  c.setPixel(0, 0, red);
  c.setPixel(1, 1, blue);
  c.setPixel(2, 0, red);
  c.setPixel(2, 1, blue);
  frame("pixels", cs.flush());
  c.fillRect(0, 2, 4, 2, rgb(0, 255, 0));
  frame("fillRect", cs.flush());
  c.clear(COLOR_DEFAULT);
  c.line(0, 0, 3, 3, red);
  frame("line", cs.flush());
  console.log(`pixel (1,1) ${c.pixel(1, 1) === red} (1,2) ${c.pixel(1, 2) === COLOR_DEFAULT} off ${c.pixel(9, 0)}`);
  c.clear(COLOR_DEFAULT);
  c.line(1, 0, 2000000000, 1, red);
  c.line(3, 3, -2000000000, -1000000000, blue);
  frame("lines to far endpoints stop at the edge", cs.flush());
  c.fillRect(-2, -2, 100, 100, blue);
  c.text(1, 0, "ok", red);
  frame("text over pixels", cs.flush());

  // --- a frame loop: `flush` stores nothing into the screen, so each pass's
  // string is taken back with the pass (tests/run.js reads `--emit-arena`) ---
  const game = new Screen(8, 2, false);
  let sent = 0;
  for (let f = 0; f < 1000; f++) {
    game.set(f % 8, f % 2, 65 + (f % 26), rgb(f % 256, 0, 0), COLOR_DEFAULT, ATTR_NONE);
    const out = game.flush();
    sent = sent + out.length;
  }
  console.log(`frame loop sent ${sent} bytes`);

  // --- the fixed-step clock: 250 steps a second is 4 ms a step, at most 8 ---
  const logic = new FixedStep(250, 8);
  const steps: string[] = [];
  steps.push(`${logic.advance(toF64(1000))}`);
  steps.push(`${logic.advance(toF64(1003))}`);
  steps.push(`${logic.advance(toF64(1009))}`);
  steps.push(`${logic.advance(toF64(1009))}`);
  steps.push(`${logic.advance(toF64(1050))}`);
  steps.push(`${logic.advance(toF64(1040))}`);
  steps.push(`${logic.advance(toF64(1045))}`);
  console.log(`steps ${steps.join(" ")} alpha ${Math.floor(logic.alpha() * toF64(100))}%`);
  const behind = new FixedStep(100, 3);
  behind.advance(toF64(0));
  const caught = behind.advance(toF64(1005));
  console.log(`a long stall runs ${caught} and keeps the phase: alpha ${Math.floor(behind.alpha() * toF64(100))}%`);
  const draw = new FixedStep(100, 1);
  let frames = 0;
  draw.advance(toF64(0));
  for (let ms = 1; ms <= 1000; ms++) {
    frames = frames + draw.advance(toF64(ms));
  }
  console.log(`a 100 Hz draw clock over a second of 1 ms ticks: ${frames} frames`);
  const odd = new FixedStep(0, 0);
  console.log(`clamped: step ${odd.stepMs} ms, at most ${odd.maxSteps}`);

  // --- keys ----------------------------------------------------------------
  const d = new KeyDecoder(toF64(30));
  events("arrows", d.feed(bytesOf([27, 91, 65, 27, 91, 66, 27, 79, 67, 27, 79, 68]), 12, toF64(0)), d);
  events("controls", d.feed(bytesOf([3, 13, 10, 32, 9, 127, 8, 1]), 8, toF64(0)), d);
  events("printable", d.feed(bytesOf([113, 81, 126, 195, 169, 226, 150, 128]), 8, toF64(0)), d);
  events("count bounds the read", d.feed(bytesOf([97, 98, 99]), 1, toF64(0)), d);
  events("split ESC | [A, first", d.feed(bytesOf([27]), 1, toF64(100)), d);
  events("split ESC | [A, then", d.feed(bytesOf([91, 65]), 2, toF64(110)), d);
  events("split ESC[ | B, first", d.feed(bytesOf([27, 91]), 2, toF64(200)), d);
  events("split ESC[ | B, then", d.feed(bytesOf([66]), 1, toF64(210)), d);
  events("split ESC O | C, first", d.feed(bytesOf([27, 79]), 2, toF64(300)), d);
  events("split ESC O | C, then", d.feed(bytesOf([67]), 1, toF64(305)), d);
  events("parameters, ESC[1;5A", d.feed(bytesOf([27, 91, 49, 59, 53, 65]), 6, toF64(400)), d);
  events("other final, ESC[3~", d.feed(bytesOf([27, 91, 51, 126]), 4, toF64(400)), d);
  events("lone ESC, first", d.feed(bytesOf([27]), 1, toF64(500)), d);
  events("lone ESC, poll early", d.poll(toF64(520)), d);
  events("lone ESC, poll late", d.poll(toF64(530)), d);
  events("ESC then a letter", d.feed(bytesOf([27, 120]), 2, toF64(600)), d);
  events("ESC ESC [ A", d.feed(bytesOf([27, 27, 91, 65]), 4, toF64(600)), d);
  events("held ESC timed out by the next feed", d.feed(bytesOf([27]), 1, toF64(700)), d);
  events("  next feed", d.feed(bytesOf([120]), 1, toF64(800)), d);
  events("split UTF-8, first", d.feed(bytesOf([195]), 1, toF64(900)), d);
  events("split UTF-8, then", d.feed(bytesOf([169]), 1, toF64(901)), d);
  events("unfinished UTF-8 timed out", d.feed(bytesOf([226, 150]), 2, toF64(1000)), d);
  events("  poll", d.poll(toF64(1100)), d);
  events("invalid bytes", d.feed(bytesOf([255, 128, 97]), 3, toF64(1200)), d);
  events("a character cut short by another", d.feed(bytesOf([226, 150, 97]), 3, toF64(1250)), d);
  events("empty feed", d.feed(bytesOf([]), 0, toF64(1300)), d);
  events("held over two feeds, first", d.feed(bytesOf([27]), 1, toF64(2000)), d);
  events("held over two feeds, then", d.feed(bytesOf([91]), 1, toF64(2025)), d);
  events("  timed from the first", d.poll(toF64(2035)), d);
  events("ESC O and no final", d.feed(bytesOf([27, 79, 10]), 3, toF64(2100)), d);
  events("past U+10FFFF lead", d.feed(bytesOf([245, 128, 97]), 3, toF64(2200)), d);
  events("overlong, surrogate, too high", d.feed(bytesOf([224, 128, 128, 237, 160, 128, 244, 144, 128, 128]), 10, toF64(2200)), d);
  events("four bytes", d.feed(bytesOf([240, 159, 152, 128]), 4, toF64(2200)), d);
  return 0;
};
