/**
 * `std/term` — a terminal drawn as a grid of coloured cells, and the keys a
 * terminal sends turned into events.
 *
 *     import { Screen, Canvas, rgb, COLOR_DEFAULT, enterAltScreen, hideCursor } from "nish/term";
 *
 *     const screen = new Screen(80, 24, false);
 *     write(enterAltScreen() + hideCursor());
 *     screen.clear(COLOR_DEFAULT);
 *     screen.text(2, 1, "score 0", rgb(255, 255, 0), COLOR_DEFAULT, 0);
 *     write(screen.flush()); // the whole frame the first time, then only what changed
 *
 * **No I/O.** Nothing here reads the terminal or writes to it: a `Screen` turns
 * the cells a program drew into the string that brings the terminal from the
 * last frame to this one, and a `KeyDecoder` turns the bytes a program read
 * into key events. The program writes the string with `write` and reads the
 * bytes however it reads its input; the size of the terminal, raw mode and the
 * clock are the caller's, passed in as numbers. So this module reaches no
 * capability, a test can compare its output byte for byte, and it runs the
 * same under Node.
 *
 * **A `Screen`** holds `width × height` cells, each a code point, a foreground,
 * a background and two attributes (bold, inverse), twice over: the frame being
 * drawn and the frame the terminal was last sent. `flush` walks both and emits
 * only the cells that differ — a cursor move where it is not already in place,
 * a style change only where the style differs from the cell before it, and the
 * glyph's UTF-8 bytes — then makes the drawn frame the sent one. Every glyph is
 * taken to be one column wide; a wide character (most CJK, most emoji) would
 * push the rest of its row along, and is the caller's to avoid.
 *
 * **A `Canvas`** draws pixels on a `Screen`: each cell shows two, one above the
 * other, with the upper half block "▀" in the top pixel's colour on a background
 * of the bottom pixel's (and the lower half block "▄" when only the bottom
 * pixel is set). A terminal cell is about twice as tall as it is wide, so the
 * pixels come out roughly square.
 *
 * **Colour** is 24-bit RGB, an `i32` `0xRRGGBB` made by `rgb`, or
 * `COLOR_DEFAULT` for the terminal's own colour. A `Screen` made with
 * `palette256` set sends each colour as the nearest of the 256-colour palette
 * instead, for a terminal without true colour; deciding which a terminal has
 * (`COLORTERM` is the usual sign) is the caller's.
 *
 * **Events.** `KeyDecoder.feed` and `poll` answer `KeyEvent`s, as they always
 * have. `KeyDecoder.feedEvents(bytes, count, nowMs)` and `pollEvents(nowMs)`
 * read the same bytes as one stream of `TermEvent`s, whose `type` is an
 * `EVENT_` constant:
 *
 * - `EVENT_KEY`, a key with its `KEY_` kind and `code`, its `MOD_` bits
 *   (`MOD_SHIFT`, `MOD_ALT`, `MOD_CTRL`, `MOD_SUPER`, `MOD_HYPER`, `MOD_META`)
 *   and its `ACTION_` (`ACTION_PRESS`, `ACTION_REPEAT`, `ACTION_RELEASE`):
 *   legacy keys, xterm's modified keys and modifyOtherKeys
 *   (`ESC [ 27 ; m ; c ~`), and the kitty keyboard protocol's
 *   `ESC [ code ; mods:event ; text u` (sw.kovidgoyal.net/kitty/keyboard-protocol);
 * - `EVENT_MOUSE`, an SGR report `ESC [ < b ; x ; y M|m` (xterm ctlseqs, mode
 *   1006, or 1016 in pixels with `pixelMouse` set) with its `MOUSE_` button,
 *   `ACTION_PRESS`, `ACTION_RELEASE` or `ACTION_MOVE`, and cell `x`, `y`;
 * - `EVENT_PASTE`, everything between `ESC [ 200 ~` and `ESC [ 201 ~` (xterm
 *   ctlseqs, "Bracketed Paste Mode") as one `text`, never as keys;
 * - `EVENT_FOCUS`, `ESC [ I` or `ESC [ O` (mode 1004), `gained` or not;
 * - `EVENT_REPLY`, every answer a terminal sends to a query — DA, DSR, CPR,
 *   DECRPM, the kitty flags, XTVERSION and DECRQSS (DCS), OSC, APC — with its
 *   `introducer`, `prefix`, `params`, `intermediate`, final byte `reply` and
 *   `text`. A reply never reaches the program as a key. `ESC [ row ; col R` is
 *   both a cursor position report and F3 with modifiers, so a caller that asks
 *   for one (`ESC [ 6 n`) adds 1 to `cprOutstanding`, and while it is above 0
 *   the next `R` is the reply, taking 1 off;
 * - `EVENT_RESIZE` and `EVENT_QUIT`, which the caller and `KeyState` make.
 *
 * An unfinished sequence is held for `escapeTimeoutMs` after the last byte arrived,
 * then given up by `pollEvents` as `feed` would; a control string cut off by
 * the timeout is dropped whole. A paste is never timed out.
 *
 * **A `KeyState`** turns those events into which keys are down. `apply(events,
 * nowMs)` answers the events to act on and `tick(nowMs)` the releases due
 * meanwhile; `isDown(key, code)` asks. A terminal without the kitty protocol
 * sends no releases, so while `releasesAreSynthetic` is set (until the first
 * real release) a key counts as let go when its repeats stop: `firstRepeatMs`
 * after its press, then `releaseGapMs` after its last repeat. Losing focus lets
 * every key go, and Ctrl-C becomes `EVENT_QUIT` while `quitOnCtrlC` is set.
 *
 * **The same bytes under Node.** Natively a string is UTF-8 bytes, and `flush`
 * builds its answer as bytes and makes one string of them. Under Node a string
 * is UTF-16 units and `write` encodes it as UTF-8, so there `flush` decodes the
 * same bytes into code units first: the terminal receives the same bytes either
 * way, which `tests/run.js` checks ("nish/term prints the same bytes under
 * runtime/nish.mjs"). `text` reads a string's code points as UTF-8 natively and
 * as UTF-16 under Node, so a string literal draws the same cells both ways.
 * Integer division is spelled `(a / b) | 0`, which truncates in both.
 */

/** The terminal's own colour, foreground or background: SGR 39 and 49. */
export const COLOR_DEFAULT: i32 = -1

/** No attributes: plain text. */
export const ATTR_NONE: i32 = 0

/** The bold attribute bit: SGR 1. */
export const ATTR_BOLD: i32 = 1

/** The inverse-video attribute bit, foreground and background swapped: SGR 7. */
export const ATTR_INVERSE: i32 = 2

/** A printable character; the event's `code` is its code point. */
export const KEY_CHAR: i32 = 1

/** The up arrow, `ESC [ A` or `ESC O A`. */
export const KEY_UP: i32 = 2

/** The down arrow, `ESC [ B` or `ESC O B`. */
export const KEY_DOWN: i32 = 3

/** The right arrow, `ESC [ C` or `ESC O C`. */
export const KEY_RIGHT: i32 = 4

/** The left arrow, `ESC [ D` or `ESC O D`. */
export const KEY_LEFT: i32 = 5

/** Enter: a carriage return (13) or a line feed (10), which is the byte's `code`. */
export const KEY_ENTER: i32 = 6

/** The space bar (32). */
export const KEY_SPACE: i32 = 7

/** The escape key: an ESC that no sequence followed within the timeout. */
export const KEY_ESCAPE: i32 = 8

/** Ctrl-C, byte 3, which a terminal in raw mode delivers instead of a signal. */
export const KEY_CTRL_C: i32 = 9

/** Tab (9). */
export const KEY_TAB: i32 = 10

/** Backspace: DEL (127) or BS (8), which is the byte's `code`. */
export const KEY_BACKSPACE: i32 = 11

/** Any other control byte below 32; the event's `code` is the byte (Ctrl-A is 1). */
export const KEY_CONTROL: i32 = 12

/** An escape sequence this decoder does not name; the event's `code` is its final byte. */
export const KEY_UNKNOWN: i32 = 13

/** F1: `ESC O P`, `ESC [ 1 ; m P`, `ESC [ 11 ~` or the Linux console's `ESC [ [ A`. F1–F12 are consecutive, so Fn is `KEY_F1 + n - 1`. */
export const KEY_F1: i32 = 14

/** F2: `ESC O Q`, `ESC [ 1 ; m Q`, `ESC [ 12 ~` or `ESC [ [ B`. */
export const KEY_F2: i32 = 15

/** F3: `ESC O R`, `ESC [ 1 ; m R` (when no cursor report is awaited), `ESC [ 13 ~` or `ESC [ [ C`. */
export const KEY_F3: i32 = 16

/** F4: `ESC O S`, `ESC [ 1 ; m S`, `ESC [ 14 ~` or `ESC [ [ D`. */
export const KEY_F4: i32 = 17

/** F5: `ESC [ 15 ~` or `ESC [ [ E`. */
export const KEY_F5: i32 = 18

/** F6: `ESC [ 17 ~`. */
export const KEY_F6: i32 = 19

/** F7: `ESC [ 18 ~`. */
export const KEY_F7: i32 = 20

/** F8: `ESC [ 19 ~`. */
export const KEY_F8: i32 = 21

/** F9: `ESC [ 20 ~`. */
export const KEY_F9: i32 = 22

/** F10: `ESC [ 21 ~`. */
export const KEY_F10: i32 = 23

/** F11: `ESC [ 23 ~`. */
export const KEY_F11: i32 = 24

/** F12: `ESC [ 24 ~`. */
export const KEY_F12: i32 = 25

/** Home: `ESC [ H`, `ESC O H`, `ESC [ 1 ~` or `ESC [ 7 ~`. */
export const KEY_HOME: i32 = 26

/** End: `ESC [ F`, `ESC O F`, `ESC [ 4 ~` or `ESC [ 8 ~`. */
export const KEY_END: i32 = 27

/** Page Up: `ESC [ 5 ~`. */
export const KEY_PAGE_UP: i32 = 28

/** Page Down: `ESC [ 6 ~`. */
export const KEY_PAGE_DOWN: i32 = 29

/** Insert: `ESC [ 2 ~`. */
export const KEY_INSERT: i32 = 30

/** Delete (the key, not DEL the byte): `ESC [ 3 ~`. */
export const KEY_DELETE: i32 = 31

/** A `TermEvent` that is a key: `key`, `code`, `modifiers` and `action`. */
export const EVENT_KEY: i32 = 1

/** A `TermEvent` that is the mouse: `button`, `action`, `modifiers`, the cell `x`, `y` and, under mode 1016, the pixel `px`, `py`. */
export const EVENT_MOUSE: i32 = 2

/** A `TermEvent` that is a bracketed paste: `text` is everything between `ESC [ 200 ~` and `ESC [ 201 ~`. */
export const EVENT_PASTE: i32 = 3

/** A `TermEvent` that is a focus change, `ESC [ I` or `ESC [ O`: `gained` says which. */
export const EVENT_FOCUS: i32 = 4

/** A `TermEvent` that is a new terminal size. The decoder never makes one: it is for the code that watches the size. */
export const EVENT_RESIZE: i32 = 5

/** A `TermEvent` that is the terminal answering a query: `introducer`, `prefix`, `params`, `intermediate`, `reply` and `text`. Never a key. */
export const EVENT_REPLY: i32 = 6

/** A `TermEvent` that asks the program to quit: what `KeyState` makes of Ctrl-C. */
export const EVENT_QUIT: i32 = 7

/** A key or button went down. */
export const ACTION_PRESS: i32 = 1

/** A held key repeated. */
export const ACTION_REPEAT: i32 = 2

/** A key or button came up. */
export const ACTION_RELEASE: i32 = 3

/** The mouse moved, with `button` held or `MOUSE_NONE`. */
export const ACTION_MOVE: i32 = 4

/** The Shift bit of `modifiers`. The bits are the kitty keyboard protocol's modifier value minus one, which the xterm `; m` forms share. */
export const MOD_SHIFT: i32 = 1

/** The Alt bit of `modifiers`; also set for an ESC followed by an ASCII key. */
export const MOD_ALT: i32 = 2

/** The Ctrl bit of `modifiers`. */
export const MOD_CTRL: i32 = 4

/** The Super bit of `modifiers` (the Windows or Command key). */
export const MOD_SUPER: i32 = 8

/** The Hyper bit of `modifiers` (kitty only). */
export const MOD_HYPER: i32 = 16

/** The Meta bit of `modifiers` (kitty only). */
export const MOD_META: i32 = 32

/** No button: a move with nothing held, or a release a terminal does not name. */
export const MOUSE_NONE: i32 = 0

/** The left button. */
export const MOUSE_LEFT: i32 = 1

/** The middle button. */
export const MOUSE_MIDDLE: i32 = 2

/** The right button. */
export const MOUSE_RIGHT: i32 = 3

/** The wheel turned up; `MOUSE_WHEEL_DOWN`, `_LEFT` and `_RIGHT` follow it. A wheel only ever presses. */
export const MOUSE_WHEEL_UP: i32 = 4

/** The wheel turned down. */
export const MOUSE_WHEEL_DOWN: i32 = 5

/** The wheel tilted left. */
export const MOUSE_WHEEL_LEFT: i32 = 6

/** The wheel tilted right. */
export const MOUSE_WHEEL_RIGHT: i32 = 7

/** Button 8 (back on most mice); 9, 10 and 11 follow it. */
export const MOUSE_BUTTON_8: i32 = 8

/** The escape byte that starts every control sequence. */
const TERM_ESC: i32 = 27

/** The space a blank cell holds. */
const TERM_SPACE: i32 = 32

/** DEL, the first byte past printable ASCII. */
const TERM_DELETE: i32 = 127

/** `[`, which follows ESC to begin a control sequence. */
const TERM_BRACKET: i32 = 91

/** `;`, between a control sequence's parameters. */
const TERM_SEMICOLON: i32 = 59

/** `0`, the first decimal digit. */
const TERM_DIGIT_0: i32 = 48

/** `H`, the final byte of a cursor position: `ESC [ row ; col H`. */
const TERM_FINAL_POSITION: i32 = 72

/** `C`, the final byte of a cursor move along the row: `ESC [ n C`. */
const TERM_FINAL_FORWARD: i32 = 67

/** `m`, the final byte of a style (SGR). */
const TERM_FINAL_STYLE: i32 = 109

/** `?`, which marks a DEC private mode: `ESC [ ? n h` sets mode n, `ESC [ ? n l` resets it. */
const TERM_PRIVATE: i32 = 63

/** `h`, the final byte that sets a mode. */
const TERM_FINAL_SET: i32 = 104

/** `l`, the final byte that resets a mode. */
const TERM_FINAL_RESET: i32 = 108

/** The DEC private mode of synchronized output: the terminal holds what it is sent until the mode is reset, then paints it at once. */
const TERM_SYNC_MODE: i32 = 2026

/** The SGR base of a foreground colour: 38 sets one, 39 is the default. */
const TERM_SGR_FOREGROUND: i32 = 30

/** The SGR base of a background colour: 48 sets one, 49 is the default. */
const TERM_SGR_BACKGROUND: i32 = 40

/** A front-buffer code point no glyph has, so the cell is sent on the next flush. */
const TERM_UNSENT: i32 = -1

/** A style the terminal is not known to be in, so the next cell sends its own in full. */
const TERM_STYLE_UNKNOWN: i32 = -2

/**
 * The most bytes one cell can add to a flush: a move, a full SGR and a 4-byte
 * glyph, rounded up. A flush reserves this once more for what is not a cell:
 * the closing `ESC [ 0 m` and the two synchronized-output escapes, 20 bytes.
 */
const TERM_CELL_BYTES: i32 = 64

/** The most unchanged cells `flush` rewrites to bridge a gap rather than move the cursor over it. */
const TERM_BRIDGE: i32 = 3

/** The upper half block, U+2580: a `Canvas` cell's top pixel in the foreground. */
const TERM_UPPER_HALF: i32 = 9600

/** The lower half block, U+2584: a `Canvas` cell with only its bottom pixel set. */
const TERM_LOWER_HALF: i32 = 9604

/** U+FFFD, decoded from a byte that does not begin or continue a UTF-8 sequence. */
const TERM_REPLACEMENT: i32 = 65533

/** Whether a string here is UTF-8 bytes (natively) rather than UTF-16 units (under Node). */
const termNativeStrings = (): boolean => toI32("▀".length) === 3

/** `v` held to `lo`–`hi`. */
const termClamp = (v: i32, lo: i32, hi: i32): i32 => {
  if (v < lo) {
    return lo
  }
  return v > hi ? hi : v
}

/** How many bytes a UTF-8 character whose first byte is `c` (128 or more) says it takes. */
const termLeadWidth = (c: i32): i32 => {
  if (c >= 240) {
    return 4
  }
  if (c >= 224) {
    return 3
  }
  return c >= 192 ? 2 : 1
}

/** The code point bits the first byte `c` of a `width`-byte UTF-8 character carries. */
const termLeadBits = (c: i32, width: i32): i32 => {
  if (width === 2) {
    return c & 31
  }
  return width === 3 ? c & 15 : c & 7
}

/** The colour with red, green and blue each in 0–255, as `0xRRGGBB`; a component outside is clamped. */
export const rgb = (r: i32, g: i32, b: i32): i32 =>
  (termClamp(r, 0, 255) << 16) | (termClamp(g, 0, 255) << 8) | termClamp(b, 0, 255)

/** The index of the 6×6×6 colour cube's level (0–5) nearest one component in 0–255. */
const termCubeLevel = (v: i32): i32 => {
  if (v < 48) {
    return 0
  }
  if (v < 115) {
    return 1
  }
  return ((v - 35) / 40) | 0
}

/** The component value of cube level `q`: 0, 95, 135, 175, 215 or 255. */
const termCubeValue = (q: i32): i32 => (q === 0 ? 0 : q * 40 + 55)

/**
 * The 256-colour palette index nearest `colour`: one of the 6×6×6 cube
 * (16–231) or of the 24 greys (232–255), whichever is closer in RGB.
 * `COLOR_DEFAULT` stays itself.
 */
export const paletteIndex = (colour: i32): i32 => {
  if (colour < 0) {
    return COLOR_DEFAULT
  }
  const r: i32 = (colour >> 16) & 255
  const g: i32 = (colour >> 8) & 255
  const b: i32 = colour & 255
  const qr: i32 = termCubeLevel(r)
  const qg: i32 = termCubeLevel(g)
  const qb: i32 = termCubeLevel(b)
  const cube: i32 = qr * 36 + qg * 6 + qb + 16
  const dr: i32 = r - termCubeValue(qr)
  const dg: i32 = g - termCubeValue(qg)
  const db: i32 = b - termCubeValue(qb)
  const cubeDistance: i32 = dr * dr + dg * dg + db * db
  const average: i32 = ((r + g + b) / 3) | 0
  const step: i32 = average > 238 ? 23 : termClamp(((average - 3) / 10) | 0, 0, 23)
  const grey: i32 = step * 10 + 8
  const gr: i32 = r - grey
  const gg: i32 = g - grey
  const gb: i32 = b - grey
  const greyDistance: i32 = gr * gr + gg * gg + gb * gb
  return greyDistance < cubeDistance ? step + 232 : cube
}

/** Switch to the alternate screen, which the terminal restores the old contents from on leaving. */
export const enterAltScreen = (): string => "\x1b[?1049h"

/** Leave the alternate screen and show what was there before `enterAltScreen`. */
export const leaveAltScreen = (): string => "\x1b[?1049l"

/** Hide the cursor, so a redraw does not flicker it across the screen. */
export const hideCursor = (): string => "\x1b[?25l"

/** Show the cursor again. */
export const showCursor = (): string => "\x1b[?25h"

/** Move the cursor home and erase the whole screen; a `Screen` that was drawn on wants `invalidate` after it. */
export const clearScreen = (): string => "\x1b[H\x1b[2J"

/** Reset colour and attributes to the terminal's defaults: SGR 0. */
export const resetStyle = (): string => "\x1b[0m"

/** Move the cursor to column `x`, row `y`, both from 0. */
export const moveCursor = (x: i32, y: i32): string => `\x1b[${y + 1};${x + 1}H`

/**
 * Begin a synchronized update (DEC mode 2026): a terminal that knows the mode
 * holds what follows until `endSync`, then paints it in one go, so a frame is
 * never seen half drawn. One that does not ignores it.
 */
export const beginSync = (): string => "\x1b[?2026h"

/** End a synchronized update, so the terminal paints what `beginSync` held. */
export const endSync = (): string => "\x1b[?2026l"

/**
 * The code point of the character that starts at unit `i` of `s`: UTF-8 bytes
 * natively, UTF-16 units under Node. A unit that cannot start one is U+FFFD.
 */
const termCodePointAt = (s: string, i: i32, n: i32): i32 => {
  const c: i32 = toI32(s.charCodeAt(i))
  if (!termNativeStrings()) {
    if (c >= 55296 && c < 56320 && i + 1 < n) {
      const lo: i32 = toI32(s.charCodeAt(i + 1))
      if (lo >= 56320 && lo < 57344) {
        return ((c - 55296) << 10) + (lo - 56320) + 65536
      }
    }
    return c
  }
  const width: i32 = termCodePointUnits(s, i, n)
  if (c < 128) {
    return c
  }
  if (width === 1) {
    return TERM_REPLACEMENT
  }
  let cp: i32 = termLeadBits(c, width)
  for (let k: i32 = 1; k < width; k++) {
    cp = (cp << 6) | (toI32(s.charCodeAt(i + k)) & 63)
  }
  return cp
}

/** How many units of `s` the character at `i` takes: 1–4 bytes natively, 1 or 2 units under Node. */
const termCodePointUnits = (s: string, i: i32, n: i32): i32 => {
  const c: i32 = toI32(s.charCodeAt(i))
  if (!termNativeStrings()) {
    if (c >= 55296 && c < 56320 && i + 1 < n) {
      const lo: i32 = toI32(s.charCodeAt(i + 1))
      return lo >= 56320 && lo < 57344 ? 2 : 1
    }
    return 1
  }
  const width: i32 = c >= 248 ? 1 : termLeadWidth(c)
  if (width === 1 || i + width > n) {
    return 1
  }
  for (let k: i32 = 1; k < width; k++) {
    const next: i32 = toI32(s.charCodeAt(i + k))
    if (next < 128 || next >= 192) {
      return 1
    }
  }
  return width
}

/**
 * The string of `bytes[0, n)`, which hold UTF-8. Natively that is the bytes
 * themselves; under Node each code point becomes its UTF-16 units, so `write`
 * sends the same bytes back out.
 */
const termBytesText = (bytes: u8[], n: i32): string => {
  if (termNativeStrings()) {
    return String.fromBytes(bytes, 0, n)
  }
  const pieces: string[] = []
  let run: i32 = 0
  let i: i32 = 0
  while (i < n) {
    if (!(i >= 0 && i < toI32(bytes.length))) {
      panic("nish/term: a byte count past the end of its buffer")
    }
    const c: i32 = toI32(bytes[i])
    if (c < 128) {
      i = i + 1
      continue
    }
    if (run < i) {
      pieces.push(String.fromBytes(bytes, run, i))
    }
    const width: i32 = termLeadWidth(c)
    let cp: i32 = width === 1 ? TERM_REPLACEMENT : termLeadBits(c, width)
    for (let k: i32 = 1; k < width && i + k < n; k++) {
      cp = (cp << 6) | (toI32(bytes[i + k]) & 63)
    }
    if (cp >= 65536) {
      const v: i32 = cp - 65536
      pieces.push(String.fromCharCode((v >> 10) + 55296) + String.fromCharCode((v & 1023) + 56320))
    } else {
      pieces.push(String.fromCharCode(cp))
    }
    i = i + width
    run = i
  }
  if (run < n) {
    pieces.push(String.fromBytes(bytes, run, n))
  }
  return pieces.join("")
}

/** A grid of coloured cells, double-buffered, and the escapes that bring a terminal up to date with it. */
export class Screen {
  /** The frame being drawn, one code point per cell, row by row. */
  glyphs: i32[]
  /** The frame's foregrounds, laid out as `glyphs`: a colour or `COLOR_DEFAULT`. */
  fgs: i32[]
  /** The frame's backgrounds, laid out as `glyphs`. */
  bgs: i32[]
  /** The frame's attributes, laid out as `glyphs`: `ATTR_BOLD` and `ATTR_INVERSE`, or'd. */
  attrs: i32[]
  /** The code points the terminal was last sent; -1 is a cell not yet sent. */
  sentGlyphs: i32[]
  /** The foregrounds the terminal was last sent. */
  sentFgs: i32[]
  /** The backgrounds the terminal was last sent. */
  sentBgs: i32[]
  /** The attributes the terminal was last sent. */
  sentAttrs: i32[]
  /** The bytes `flush` builds, sized by `resize` and reused from frame to frame. */
  out: u8[]
  /** Columns. */
  width: i32
  /** Rows. */
  height: i32
  /** How many of `out` the flush in progress has written. */
  outLen: i32
  /** Whether colours go out as 256-colour palette indices rather than 24-bit RGB. */
  palette256: boolean
  /** Whether a `flush` that changes anything is wrapped in `beginSync` and `endSync`; off until set. */
  sync: boolean

  /**
   * A `width × height` screen of blank cells in the terminal's colours, none
   * of them sent yet, so the first `flush` draws them all. With `palette256`
   * set, every colour is sent as its nearest 256-colour index (`paletteIndex`).
   */
  constructor(width: i32, height: i32, palette256: boolean) {
    this.width = width < 0 ? 0 : width
    this.height = height < 0 ? 0 : height
    this.palette256 = palette256
    this.sync = false
    this.glyphs = []
    this.fgs = []
    this.bgs = []
    this.attrs = []
    this.sentGlyphs = []
    this.sentFgs = []
    this.sentBgs = []
    this.sentAttrs = []
    this.out = []
    this.outLen = 0
    this.resize(this.width, this.height)
  }

  /** Make the screen `width × height`, blank and unsent: a terminal that changed size is redrawn in full. */
  resize(width: i32, height: i32): void {
    this.width = width < 0 ? 0 : width
    this.height = height < 0 ? 0 : height
    const cells: i32 = this.width * this.height
    this.glyphs = new Array<i32>(cells)
    this.fgs = new Array<i32>(cells)
    this.bgs = new Array<i32>(cells)
    this.attrs = new Array<i32>(cells)
    this.sentGlyphs = new Array<i32>(cells)
    this.sentFgs = new Array<i32>(cells)
    this.sentBgs = new Array<i32>(cells)
    this.sentAttrs = new Array<i32>(cells)
    // Sized here rather than in `flush`, so a flush stores nothing into the
    // screen and a frame loop around it can take its string back every pass.
    this.out = new Array<u8>(cells * TERM_CELL_BYTES + TERM_CELL_BYTES)
    this.clear(COLOR_DEFAULT)
    this.invalidate()
  }

  /** Blank every cell of the frame being drawn: a space on `background`, default foreground, no attributes. */
  clear(background: i32): void {
    this.glyphs.fill(TERM_SPACE)
    this.fgs.fill(COLOR_DEFAULT)
    this.bgs.fill(background)
    this.attrs.fill(ATTR_NONE)
  }

  /** Forget what the terminal shows, so the next `flush` sends every cell: after a `clearScreen`, say. */
  invalidate(): void {
    this.sentGlyphs.fill(TERM_UNSENT)
    this.sentFgs.fill(COLOR_DEFAULT)
    this.sentBgs.fill(COLOR_DEFAULT)
    this.sentAttrs.fill(ATTR_NONE)
  }

  /**
   * Draw code point `glyph` at column `x`, row `y`; a cell off the screen is
   * not drawn. Bits of `attrs` other than `ATTR_BOLD` and `ATTR_INVERSE` are
   * dropped, so `flush` never has an attribute it cannot write.
   */
  set(x: i32, y: i32, glyph: i32, fg: i32, bg: i32, attrs: i32): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return
    }
    const i: i32 = y * this.width + x
    if (!(i >= 0 && i < toI32(this.glyphs.length))) {
      return
    }
    this.glyphs[i] = glyph
    this.fgs[i] = fg
    this.bgs[i] = bg
    this.attrs[i] = attrs & (ATTR_BOLD | ATTR_INVERSE)
  }

  /**
   * Draw `s` from column `x` of row `y`, one cell per character, clipped at
   * the edges, and answer the column after its last character.
   */
  text(x: i32, y: i32, s: string, fg: i32, bg: i32, attrs: i32): i32 {
    const n: i32 = toI32(s.length)
    let column: i32 = x
    let i: i32 = 0
    while (i < n) {
      this.set(column, y, termCodePointAt(s, i, n), fg, bg, attrs)
      i = i + termCodePointUnits(s, i, n)
      column = column + 1
    }
    return column
  }

  /** The code point drawn at column `x`, row `y` of the frame being drawn, or -1 off the screen. */
  glyphAt(x: i32, y: i32): i32 {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return -1
    }
    return this.glyphs[y * this.width + x]
  }

  /** Append one byte to the flush in progress; `flush` has reserved the room. */
  put(b: i32): void {
    this.out[this.outLen] = toU8(b)
    this.outLen = this.outLen + 1
  }

  /** Append `v`, at least 0, in decimal: the three digits a colour channel has without recursing. */
  putDecimal(v: i32): void {
    if (v >= 100) {
      if (v >= 1000) {
        this.putDecimal((v / 1000) | 0)
      }
      this.put((((v / 100) | 0) % 10) + TERM_DIGIT_0)
    }
    if (v >= 10) {
      this.put((((v / 10) | 0) % 10) + TERM_DIGIT_0)
    }
    this.put((v % 10) + TERM_DIGIT_0)
  }

  /** Append `ESC [ ? 2026` and `final`, which sets or resets synchronized output. */
  putSyncMode(final: i32): void {
    this.put(TERM_ESC)
    this.put(TERM_BRACKET)
    this.put(TERM_PRIVATE)
    this.putDecimal(TERM_SYNC_MODE)
    this.put(final)
  }

  /**
   * Append code point `cp` as UTF-8. One that would not draw a character in
   * place, or is not a scalar value — a C0 or C1 control, DEL, a surrogate, a
   * negative number — goes as U+FFFD, so a cell cannot move the cursor, open
   * an escape or send bytes that are not UTF-8.
   */
  putGlyph(cp: i32): void {
    if (cp >= TERM_SPACE && cp < TERM_DELETE) {
      this.put(cp)
    } else if (cp >= 160 && cp < 2048) {
      this.put((cp >> 6) | 192)
      this.put((cp & 63) | 128)
    } else if (cp >= 65536 && cp < 1114112) {
      this.put((cp >> 18) | 240)
      this.put(((cp >> 12) & 63) | 128)
      this.put(((cp >> 6) & 63) | 128)
      this.put((cp & 63) | 128)
    } else {
      const c: i32 = cp >= 2048 && cp < 65536 && !(cp >= 55296 && cp < 57344) ? cp : TERM_REPLACEMENT
      this.put((c >> 12) | 224)
      this.put(((c >> 6) & 63) | 128)
      this.put((c & 63) | 128)
    }
  }

  /** Append the SGR parameters for colour `key` (an RGB or a palette index) on base 30 (foreground) or 40. */
  putColour(base: i32, key: i32): void {
    if (key < 0) {
      this.putDecimal(base + 9)
      return
    }
    this.putDecimal(base + 8)
    if (this.palette256) {
      this.put(TERM_SEMICOLON)
      this.put(TERM_DIGIT_0 + 5)
      this.put(TERM_SEMICOLON)
      this.putDecimal(key)
      return
    }
    this.put(TERM_SEMICOLON)
    this.put(TERM_DIGIT_0 + 2)
    this.put(TERM_SEMICOLON)
    this.putDecimal((key >> 16) & 255)
    this.put(TERM_SEMICOLON)
    this.putDecimal((key >> 8) & 255)
    this.put(TERM_SEMICOLON)
    this.putDecimal(key & 255)
  }

  /** The value a colour is sent as and compared by: itself, or its palette index under `palette256`. */
  colourKey(colour: i32): i32 {
    if (colour < 0) {
      return COLOR_DEFAULT
    }
    return this.palette256 ? paletteIndex(colour) : colour
  }

  /**
   * The escapes and glyphs that turn the frame last sent into the frame drawn,
   * and the drawn frame becomes the sent one. Write the answer with `write`;
   * an empty string means nothing changed.
   *
   * Changed cells are visited row by row. The cursor is moved only when it is
   * not already at the cell — `ESC [ n C` along the row, `ESC [ row ; col H`
   * otherwise — and a gap of up to three unchanged ASCII cells in the current
   * style is rewritten instead, which is shorter than the move. A style is
   * sent only when it differs from the previous cell's, and only the parts
   * that differ, from a reset when an attribute has to be turned off. A flush
   * that leaves the terminal in a style other than the default ends with
   * `ESC [ 0 m`, so what the caller writes next starts plain. With `sync` set,
   * a flush that changes anything is wrapped in `beginSync` and `endSync`, in
   * the same string, so the terminal paints the frame whole.
   */
  flush(): string {
    const w: i32 = this.width
    const cells: i32 = toI32(this.glyphs.length)
    this.outLen = 0
    const glyphs: i32[] = this.glyphs
    const fgs: i32[] = this.fgs
    const bgs: i32[] = this.bgs
    const attrs: i32[] = this.attrs
    const sentGlyphs: i32[] = this.sentGlyphs
    const sentFgs: i32[] = this.sentFgs
    const sentBgs: i32[] = this.sentBgs
    const sentAttrs: i32[] = this.sentAttrs
    if (
      !(
        toI32(fgs.length) === cells &&
        toI32(bgs.length) === cells &&
        toI32(attrs.length) === cells &&
        toI32(sentGlyphs.length) === cells &&
        toI32(sentFgs.length) === cells &&
        toI32(sentBgs.length) === cells &&
        toI32(sentAttrs.length) === cells &&
        toI32(this.out.length) >= cells * TERM_CELL_BYTES + TERM_CELL_BYTES
      )
    ) {
      panic("nish/term: a Screen's buffers disagree on its size")
    }
    if (this.sync) {
      this.putSyncMode(TERM_FINAL_SET)
    }
    const opened: i32 = this.outLen
    let styleFg: i32 = TERM_STYLE_UNKNOWN
    let styleBg: i32 = TERM_STYLE_UNKNOWN
    let styleAttrs: i32 = TERM_STYLE_UNKNOWN
    let cursorRow: i32 = -1
    let cursorCol: i32 = -1
    for (
      let i: i32 = 0;
      i < cells &&
      i < toI32(glyphs.length) &&
      i < toI32(fgs.length) &&
      i < toI32(bgs.length) &&
      i < toI32(attrs.length) &&
      i < toI32(sentGlyphs.length) &&
      i < toI32(sentFgs.length) &&
      i < toI32(sentBgs.length) &&
      i < toI32(sentAttrs.length);
      i++
    ) {
      const glyph: i32 = glyphs[i]
      const fg: i32 = fgs[i]
      const bg: i32 = bgs[i]
      const at: i32 = attrs[i]
      if (glyph === sentGlyphs[i] && fg === sentFgs[i] && bg === sentBgs[i] && at === sentAttrs[i]) {
        continue
      }
      const row: i32 = (i / w) | 0
      const col: i32 = i - row * w
      const fgKey: i32 = this.colourKey(fg)
      const bgKey: i32 = this.colourKey(bg)
      if (cursorRow !== row || cursorCol !== col) {
        const gap: i32 = col - cursorCol
        let bridged: boolean = false
        if (cursorRow === row && gap > 0 && gap <= TERM_BRIDGE) {
          bridged = true
          for (let k: i32 = i - gap; k < i; k++) {
            if (
              !(k >= 0) ||
              glyphs[k] < TERM_SPACE ||
              glyphs[k] >= TERM_DELETE ||
              attrs[k] !== styleAttrs ||
              this.colourKey(fgs[k]) !== styleFg ||
              this.colourKey(bgs[k]) !== styleBg
            ) {
              bridged = false
            }
          }
          if (bridged) {
            for (let k: i32 = i - gap; k < i; k++) {
              if (k >= 0) {
                this.put(glyphs[k])
              }
            }
          }
        }
        if (!bridged) {
          this.put(TERM_ESC)
          this.put(TERM_BRACKET)
          if (cursorRow === row && gap > 0) {
            if (gap > 1) {
              this.putDecimal(gap)
            }
            this.put(TERM_FINAL_FORWARD)
          } else if (row === 0 && col === 0) {
            this.put(TERM_FINAL_POSITION)
          } else {
            this.putDecimal(row + 1)
            this.put(TERM_SEMICOLON)
            this.putDecimal(col + 1)
            this.put(TERM_FINAL_POSITION)
          }
        }
      }
      if (fgKey !== styleFg || bgKey !== styleBg || at !== styleAttrs) {
        this.put(TERM_ESC)
        this.put(TERM_BRACKET)
        let first: boolean = true
        if (styleAttrs === TERM_STYLE_UNKNOWN || (styleAttrs & ~at) !== 0) {
          this.put(TERM_DIGIT_0)
          first = false
          styleAttrs = 0
          styleFg = COLOR_DEFAULT
          styleBg = COLOR_DEFAULT
        }
        if ((at & ATTR_BOLD) !== 0 && (styleAttrs & ATTR_BOLD) === 0) {
          if (!first) {
            this.put(TERM_SEMICOLON)
          }
          this.put(TERM_DIGIT_0 + 1)
          first = false
        }
        if ((at & ATTR_INVERSE) !== 0 && (styleAttrs & ATTR_INVERSE) === 0) {
          if (!first) {
            this.put(TERM_SEMICOLON)
          }
          this.put(TERM_DIGIT_0 + 7)
          first = false
        }
        if (fgKey !== styleFg) {
          if (!first) {
            this.put(TERM_SEMICOLON)
          }
          this.putColour(TERM_SGR_FOREGROUND, fgKey)
          first = false
        }
        if (bgKey !== styleBg) {
          if (!first) {
            this.put(TERM_SEMICOLON)
          }
          this.putColour(TERM_SGR_BACKGROUND, bgKey)
        }
        this.put(TERM_FINAL_STYLE)
        styleFg = fgKey
        styleBg = bgKey
        styleAttrs = at
      }
      this.putGlyph(glyph)
      sentGlyphs[i] = glyph
      sentFgs[i] = fg
      sentBgs[i] = bg
      sentAttrs[i] = at
      cursorRow = row
      cursorCol = col + 1
      if (cursorCol >= w) {
        cursorRow = -1
      }
    }
    if (
      styleAttrs !== TERM_STYLE_UNKNOWN &&
      (styleAttrs !== 0 || styleFg !== COLOR_DEFAULT || styleBg !== COLOR_DEFAULT)
    ) {
      this.put(TERM_ESC)
      this.put(TERM_BRACKET)
      this.put(TERM_DIGIT_0)
      this.put(TERM_FINAL_STYLE)
    }
    if (this.outLen === opened) {
      this.outLen = 0
    } else if (this.sync) {
      this.putSyncMode(TERM_FINAL_RESET)
    }
    return termBytesText(this.out, this.outLen)
  }
}

/**
 * Pixels on a `Screen`, two to a cell: `width` is the screen's columns and
 * `height` twice its rows. Each pixel is a colour or `COLOR_DEFAULT`, which is
 * the terminal's background showing through. Drawing a pixel redraws its cell
 * at once, so text drawn after it lands on top, and pixels drawn after text
 * replace it.
 */
export class Canvas {
  /** The screen the pixels are drawn on. */
  screen: Screen
  /** Pixels across: the screen's width. */
  width: i32
  /** Pixels down: twice the screen's height. */
  height: i32
  /** One colour per pixel, row by row. */
  pixels: i32[]

  /** A canvas of `screen`'s size, every pixel `COLOR_DEFAULT`. Make a new one after the screen is resized. */
  constructor(screen: Screen) {
    this.screen = screen
    this.width = screen.width
    this.height = screen.height * 2
    this.pixels = new Array<i32>(this.width * this.height)
    this.pixels.fill(COLOR_DEFAULT)
  }

  /** Set every pixel to `colour`. */
  clear(colour: i32): void {
    this.pixels.fill(colour)
    const rows: i32 = this.height >> 1
    for (let row: i32 = 0; row < rows; row++) {
      for (let col: i32 = 0; col < this.width; col++) {
        this.paintCell(col, row)
      }
    }
  }

  /** The colour of the pixel at `x`, `y`, or `COLOR_DEFAULT` off the canvas. */
  pixel(x: i32, y: i32): i32 {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return COLOR_DEFAULT
    }
    return this.pixels[y * this.width + x]
  }

  /** Set the pixel at `x`, `y` to `colour`; a pixel off the canvas is not drawn. */
  setPixel(x: i32, y: i32, colour: i32): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return
    }
    this.pixels[y * this.width + x] = colour
    this.paintCell(x, y >> 1)
  }

  /** Fill the `w × h` rectangle whose top-left pixel is `x`, `y`, clipped to the canvas. */
  fillRect(x: i32, y: i32, w: i32, h: i32, colour: i32): void {
    const left: i32 = x < 0 ? 0 : x
    const top: i32 = y < 0 ? 0 : y
    const right: i32 = x + w > this.width ? this.width : x + w
    const bottom: i32 = y + h > this.height ? this.height : y + h
    for (let py: i32 = top; py < bottom; py++) {
      for (let px: i32 = left; px < right; px++) {
        this.pixels[py * this.width + px] = colour
      }
    }
    for (let row: i32 = top >> 1; row < (bottom + 1) >> 1; row++) {
      for (let col: i32 = left; col < right; col++) {
        this.paintCell(col, row)
      }
    }
  }

  /**
   * Draw a line from `x0`, `y0` to `x1`, `y1`, both ends included (Bresenham's).
   * Any `i32` ends will do: the walk stops once it leaves the canvas for good,
   * though one that starts far outside steps all the way in.
   */
  line(x0: i32, y0: i32, x1: i32, y1: i32, colour: i32): void {
    // The error terms are f64, exact here, because a span past 2^30 overflows `2 * err` in i32.
    const dx: f64 = Math.abs(toF64(x1) - toF64(x0))
    const dy: f64 = -Math.abs(toF64(y1) - toF64(y0))
    const sx: i32 = x0 < x1 ? 1 : -1
    const sy: i32 = y0 < y1 ? 1 : -1
    let err: f64 = dx + dy
    let x: i32 = x0
    let y: i32 = y0
    while (true) {
      this.setPixel(x, y, colour)
      if (x === x1 && y === y1) {
        return
      }
      const twice: f64 = 2.0 * err
      if (twice >= dy) {
        err = err + dy
        x = x + sx
      }
      if (twice <= dx) {
        err = err + dx
        y = y + sy
      }
      // The walk only moves away from an edge it has passed, so no later point is on the canvas.
      if (
        (sx > 0 && x >= this.width) ||
        (sx < 0 && x < 0) ||
        (sy > 0 && y >= this.height) ||
        (sy < 0 && y < 0)
      ) {
        return
      }
    }
  }

  /**
   * Draw `s` in cells from column `col` of cell row `row` in `fg`, each
   * character on the colour of the pixels behind it (the top one, or the
   * bottom one where the top is unset), and answer the column after it.
   */
  text(col: i32, row: i32, s: string, fg: i32): i32 {
    const n: i32 = toI32(s.length)
    let column: i32 = col
    let i: i32 = 0
    while (i < n) {
      const top: i32 = this.pixel(column, row * 2)
      const bg: i32 = top >= 0 ? top : this.pixel(column, row * 2 + 1)
      this.screen.set(column, row, termCodePointAt(s, i, n), fg, bg, ATTR_NONE)
      i = i + termCodePointUnits(s, i, n)
      column = column + 1
    }
    return column
  }

  /** Redraw the screen cell at `col`, `row` from its two pixels. */
  paintCell(col: i32, row: i32): void {
    const top: i32 = this.pixel(col, row * 2)
    const bottom: i32 = this.pixel(col, row * 2 + 1)
    if (top < 0 && bottom < 0) {
      this.screen.set(col, row, TERM_SPACE, COLOR_DEFAULT, COLOR_DEFAULT, ATTR_NONE)
    } else if (top < 0) {
      this.screen.set(col, row, TERM_LOWER_HALF, bottom, COLOR_DEFAULT, ATTR_NONE)
    } else {
      this.screen.set(col, row, TERM_UPPER_HALF, top, bottom, ATTR_NONE)
    }
  }
}

/** One key: its `KEY_` kind and a code, which is the code point for `KEY_CHAR` and otherwise the byte that named it. */
export class KeyEvent {
  /** One of the `KEY_` constants. */
  kind: i32
  /** The character's code point, the control byte, or the escape sequence's final byte. */
  code: i32

  /** The event of kind `kind` with code `code`. */
  constructor(kind: i32, code: i32) {
    this.kind = kind
    this.code = code
  }
}

/**
 * One thing a terminal sent: a key, the mouse, a paste, a focus change or an
 * answer to a query, told apart by `type` (an `EVENT_` constant). Each type
 * fills its own fields and leaves the rest at their defaults: 0, -1 for the
 * pixel position, "" and no params.
 */
export class TermEvent {
  /** One of the `EVENT_` constants. */
  type: i32
  /** A key's `KEY_` kind. */
  key: i32
  /** A key's code: the code point for `KEY_CHAR`, the byte for a control, the kitty key number or the final byte for `KEY_UNKNOWN`. */
  code: i32
  /** The `MOD_` bits held with a key or a mouse event. */
  modifiers: i32
  /** An `ACTION_` constant: whether a key or button went down, repeated, came up or (the mouse) moved. */
  action: i32
  /** The mouse's `MOUSE_` button. */
  button: i32
  /** The mouse's column, from 0; -1 under mode 1016 while the cell size is unknown. */
  x: i32
  /** The mouse's row, from 0; -1 under mode 1016 while the cell size is unknown. */
  y: i32
  /** The mouse's pixel column, from 0, under mode 1016; -1 otherwise. */
  px: i32
  /** The mouse's pixel row, from 0, under mode 1016; -1 otherwise. */
  py: i32
  /** A paste's text, a kitty key's associated text, or the payload of a reply after its header. */
  text: string
  /** A reply's final byte (`c`, `R`, `y`, …); for an APC, its first payload byte (`G` for kitty graphics); for an OSC, 0. */
  reply: i32
  /** What opened a reply: `[` for a CSI, `P` for a DCS, `_` for an APC, `]` for an OSC, `^` for a PM, `X` for an SOS. */
  introducer: i32
  /** A reply's private marker, `?`, `>`, `=` or `<`, or 0. */
  prefix: i32
  /** A reply's intermediate byte, such as the `$` of DECRPM, or 0. */
  intermediate: i32
  /** A reply's numeric parameters, an omitted one as 0; for an OSC, its number; for `KEY_UNKNOWN`, the sequence's. */
  params: i32[]
  /** For `EVENT_FOCUS`, whether the terminal gained focus. */
  gained: boolean

  /** An event of type `type` with every other field at its default. */
  constructor(type: i32) {
    this.type = type
    this.key = 0
    this.code = 0
    this.modifiers = 0
    this.action = 0
    this.button = 0
    this.x = 0
    this.y = 0
    this.px = -1
    this.py = -1
    this.text = ""
    this.reply = 0
    this.introducer = 0
    this.prefix = 0
    this.intermediate = 0
    this.params = []
    this.gained = false
  }
}

/**
 * Bytes from a terminal in raw mode, turned into key events. A read can end
 * in the middle of an escape sequence or a UTF-8 character; the decoder keeps
 * the start and finishes it with the next `feed`. An ESC on its own is both the
 * escape key and the start of every arrow, so it is held until either more
 * bytes complete a sequence or `escapeTimeoutMs` passes with none, and then it
 * is `KEY_ESCAPE`. Whatever is held past the timeout is given up the same way:
 * the ESC as `KEY_ESCAPE`, the bytes after it as keys of their own, and an
 * unfinished UTF-8 character as U+FFFD. The clock is the caller's: each call
 * takes the time now in milliseconds, from any origin, so long as it does not
 * go backwards.
 *
 * `feedEvents` and `pollEvents` decode the same bytes into `TermEvent`s
 * instead: keys with their modifiers and press, repeat or release, the mouse,
 * pastes, focus and the terminal's replies, none of which reaches the program
 * as a key. A decoder is fed one way or the other, not both. The module
 * header lists every sequence they read.
 */
export class KeyDecoder {
  /** How long a held ESC waits for the rest of a sequence, in milliseconds. */
  escapeTimeoutMs: f64
  /** The bytes of an unfinished sequence, carried to the next call. */
  pending: u8[]
  /** When the first held byte arrived (`feed`), or the last (`feedEvents`). */
  pendingSince: f64
  /** The bytes of the paste so far. */
  pasteBytes: u8[]
  /**
   * How many cursor position reports (`ESC [ 6 n`) are awaited. `ESC [ r ; c R`
   * is both the report and F3 with modifiers; while this is above 0 it is the
   * report, and takes one off. Whoever writes the request adds one.
   */
  cprOutstanding: i32
  /** A cell's width in pixels, to turn a 1016 report into a column; 0 while unknown. */
  cellWidthPx: i32
  /** A cell's height in pixels, to turn a 1016 report into a row; 0 while unknown. */
  cellHeightPx: i32
  /** Whether SGR mouse reports are in pixels (mode 1016), so `px` and `py` are set and `x`, `y` derived. */
  pixelMouse: boolean
  /** Whether a bracketed paste has begun and not ended. */
  pasting: boolean

  /** A decoder that gives up on an unfinished sequence after `escapeTimeoutMs` (25–50 is usual). */
  constructor(escapeTimeoutMs: f64) {
    this.escapeTimeoutMs = escapeTimeoutMs
    this.pending = []
    this.pendingSince = 0.0
    this.cprOutstanding = 0
    this.pixelMouse = false
    this.cellWidthPx = 0
    this.cellHeightPx = 0
    this.pasting = false
    this.pasteBytes = []
  }

  /** Whether bytes are held, so the caller should `poll` once the timeout has passed. */
  waiting(): boolean {
    return toI32(this.pending.length) > 0
  }

  /**
   * The keys in `bytes[0, count)`, read at time `nowMs`, after whatever was
   * held: held bytes older than the timeout are given up first, as keys of
   * their own, and the rest continue into these.
   */
  feed(bytes: u8[], count: i32, nowMs: f64): KeyEvent[] {
    const events: KeyEvent[] = this.poll(nowMs)
    const held: i32 = toI32(this.pending.length)
    const work: u8[] = this.merged(bytes, count)
    if (toI32(work.length) === 0) {
      return events
    }
    const used: i32 = termDecodeKeys(work, false, events)
    // What is held now started in these bytes unless all of it was held before.
    this.keep(work, used, used >= held, nowMs)
    return events
  }

  /** The keys held bytes become once `escapeTimeoutMs` has passed since they arrived: none before then. */
  poll(nowMs: f64): KeyEvent[] {
    const events: KeyEvent[] = []
    const held: i32 = toI32(this.pending.length)
    if (held === 0 || nowMs - this.pendingSince < this.escapeTimeoutMs) {
      return events
    }
    termDecodeKeys(this.pending, true, events)
    this.pending = []
    return events
  }

  /**
   * The events in `bytes[0, count)`, read at time `nowMs`, after whatever was
   * held, as `feed` takes them. The timeout counts from the last byte that
   * arrived, so a reply split across reads is not given up halfway.
   */
  feedEvents(bytes: u8[], count: i32, nowMs: f64): TermEvent[] {
    const events: TermEvent[] = this.pollEvents(nowMs)
    const held: i32 = toI32(this.pending.length)
    const work: u8[] = this.merged(bytes, count)
    if (toI32(work.length) === 0) {
      return events
    }
    const used: i32 = termDecodeEvents(this, work, false, events)
    this.keep(work, used, toI32(work.length) > held, nowMs)
    return events
  }

  /**
   * The events held bytes become once `escapeTimeoutMs` has passed: an ESC as
   * `KEY_ESCAPE`, an unterminated DCS, APC or OSC as nothing. A paste waits
   * for its end however long it takes.
   */
  pollEvents(nowMs: f64): TermEvent[] {
    const events: TermEvent[] = []
    const held: i32 = toI32(this.pending.length)
    if (this.pasting || held === 0 || nowMs - this.pendingSince < this.escapeTimeoutMs) {
      return events
    }
    termDecodeEvents(this, this.pending, true, events)
    this.pending = []
    return events
  }

  /** The held bytes followed by `bytes[0, count)`. */
  merged(bytes: u8[], count: i32): u8[] {
    const held: i32 = toI32(this.pending.length)
    const n: i32 = termClamp(count, 0, toI32(bytes.length))
    const work: u8[] = new Array<u8>(held + n)
    const pending: u8[] = this.pending
    for (let k: i32 = 0; k < toI32(pending.length) && k < toI32(work.length); k++) {
      work[k] = pending[k]
    }
    for (let k: i32 = 0; k < n && k < toI32(bytes.length); k++) {
      work[held + k] = bytes[k]
    }
    return work
  }

  /** Hold `work` from `used` on; when `restart` is set, the held bytes count as arriving at `nowMs`. */
  keep(work: u8[], used: i32, restart: boolean, nowMs: f64): void {
    const rest: u8[] = []
    for (let k: i32 = used; k < toI32(work.length); k++) {
      if (!(k >= 0)) {
        panic("nish/term: the key decoder used more bytes than it was given")
      }
      rest.push(work[k])
    }
    if (toI32(rest.length) > 0 && restart) {
      this.pendingSince = nowMs
    }
    this.pending = rest
  }
}

/**
 * Which keys are down, from the events a `KeyDecoder` made — what a game asks
 * each frame. Under the kitty protocol with event types (flag 2) a terminal
 * sends real releases. Without it a terminal sends nothing when a key comes
 * up, only the press again as it auto-repeats, so a key is let go once no
 * repeat has come for `releaseGapMs`, or, before its first repeat, for
 * `firstRepeatMs` (a terminal waits 250–500 ms before repeating). Pure, with
 * the caller's clock, as `KeyDecoder` is.
 */
export class KeyState {
  /** How long after its last repeat a key is let go, in milliseconds (100 by default). */
  releaseGapMs: f64
  /** How long after its press a key that has not repeated is let go, in milliseconds (600 by default). */
  firstRepeatMs: f64
  /** The keys down, each as `termKeyId` names it. */
  downKeys: i32[]
  /** When each key down last pressed or repeated. */
  downSince: f64[]
  /** Whether each key down has repeated. */
  downRepeated: boolean[]
  /** Whether releases are made up from silence; false from the first real release, or when the caller knows kitty flag 2 is on. */
  releasesAreSynthetic: boolean
  /** Whether Ctrl-C (byte 3, or kitty `ESC [ 99 ; 5 u`) becomes `EVENT_QUIT` (true by default). */
  quitOnCtrlC: boolean

  /** No key down, releases synthesized, Ctrl-C a quit. */
  constructor() {
    this.releasesAreSynthetic = true
    this.releaseGapMs = 100.0
    this.firstRepeatMs = 600.0
    this.quitOnCtrlC = true
    this.downKeys = []
    this.downSince = []
    this.downRepeated = []
  }

  /**
   * Whether the key of kind `key` is down. `code` tells a `KEY_CHAR`,
   * `KEY_CONTROL` or `KEY_UNKNOWN` apart and is ignored for the rest; a
   * letter is the same key in either case, since Shift changes the code a
   * terminal sends.
   */
  isDown(key: i32, code: i32): boolean {
    return this.find(termKeyId(key, code)) >= 0
  }

  /**
   * Take `events`, which arrived at `nowMs`, and answer what the program
   * should see: first the releases `tick` makes, then each event, with
   * Ctrl-C as `EVENT_QUIT` (its repeats and release dropped) and a press of a
   * key already down marked `ACTION_REPEAT` while releases are synthetic.
   * Losing focus lets every key go, since its release goes elsewhere.
   */
  apply(events: TermEvent[], nowMs: f64): TermEvent[] {
    const out: TermEvent[] = this.tick(nowMs)
    for (let k: i32 = 0; k < toI32(events.length); k++) {
      const e: TermEvent = events[k]
      if (e.type === EVENT_FOCUS && !e.gained) {
        const first: i32 = 0
        while (toI32(this.downKeys.length) > 0) {
          this.release(first, out)
        }
      } else if (e.type === EVENT_KEY && this.quitOnCtrlC && termIsCtrlC(e)) {
        if (e.action === ACTION_PRESS) {
          out.push(new TermEvent(EVENT_QUIT))
        }
        continue
      } else if (e.type === EVENT_KEY) {
        this.press(e, nowMs)
      }
      out.push(e)
    }
    return out
  }

  /** The releases due by `nowMs` while releases are synthetic: each key whose gap has passed, let go. */
  tick(nowMs: f64): TermEvent[] {
    const out: TermEvent[] = []
    if (!this.releasesAreSynthetic) {
      return out
    }
    let k: i32 = 0
    while (k < toI32(this.downKeys.length)) {
      const gap: f64 = this.downRepeated[k] ? this.releaseGapMs : this.firstRepeatMs
      if (nowMs - this.downSince[k] >= gap) {
        this.release(k, out)
      } else {
        k = k + 1
      }
    }
    return out
  }

  /** Record key event `e` at `nowMs`. */
  press(e: TermEvent, nowMs: f64): void {
    const at: i32 = this.find(termKeyId(e.key, e.code))
    if (e.action === ACTION_RELEASE) {
      this.releasesAreSynthetic = false
      if (at >= 0) {
        this.remove(at)
      }
      return
    }
    if (at < 0) {
      this.downKeys.push(termKeyId(e.key, e.code))
      this.downSince.push(nowMs)
      this.downRepeated.push(false)
      return
    }
    this.downSince[at] = nowMs
    this.downRepeated[at] = true
    if (this.releasesAreSynthetic) {
      e.action = ACTION_REPEAT
    }
  }

  /** Let key `at` go, appending its release to `out`. */
  release(at: i32, out: TermEvent[]): void {
    const id: i32 = this.downKeys[at]
    const e: TermEvent = new TermEvent(EVENT_KEY)
    e.key = id >> 21
    e.code = id & 2097151
    e.action = ACTION_RELEASE
    out.push(e)
    this.remove(at)
  }

  /** Where key `id` is in `downKeys`, or -1. */
  find(id: i32): i32 {
    for (let k: i32 = 0; k < toI32(this.downKeys.length); k++) {
      if (this.downKeys[k] === id) {
        return k
      }
    }
    return -1
  }

  /** Drop key `at`, keeping the others in order. */
  remove(at: i32): void {
    const last: i32 = toI32(this.downKeys.length) - 1
    for (let k: i32 = at; k < last; k++) {
      this.downKeys[k] = this.downKeys[k + 1]
      this.downSince[k] = this.downSince[k + 1]
      this.downRepeated[k] = this.downRepeated[k + 1]
    }
    this.downKeys.pop()
    this.downSince.pop()
    this.downRepeated.pop()
  }
}

/**
 * A fixed-step clock: it turns the time between frames into a whole number of
 * steps of `1000 / stepsPerSecond` milliseconds, so a game's logic runs at the
 * same rate whatever the display does. `advance(nowMs)` answers how many steps
 * to run since the last call and keeps the remainder for the next; `alpha()`
 * is that remainder as a fraction of a step, to draw between the last two
 * states. At most `maxSteps` run per call: a clock further behind drops the
 * backlog rather than spiral, keeping its phase. With `maxSteps` 1 the same
 * clock paces drawing, answering 1 when a frame is due. The clock is the
 * caller's, as `KeyDecoder`'s is.
 */
export class FixedStep {
  /** The length of one step, in milliseconds. */
  stepMs: f64
  /** The time since the last step, in milliseconds, under one step after each `advance`. */
  carry: f64
  /** The time the last `advance` was given. */
  lastMs: f64
  /** The most steps one `advance` answers. */
  maxSteps: i32
  /** Whether `advance` has been called, so `lastMs` is a time. */
  started: boolean

  /** A clock of `stepsPerSecond` steps a second (1 at least), running at most `maxSteps` (1 at least) per `advance`. */
  constructor(stepsPerSecond: i32, maxSteps: i32) {
    const rate: i32 = stepsPerSecond < 1 ? 1 : stepsPerSecond
    this.stepMs = 1000.0 / toF64(rate)
    this.maxSteps = maxSteps < 1 ? 1 : maxSteps
    this.carry = 0.0
    this.lastMs = 0.0
    this.started = false
  }

  /**
   * The steps to run for the time between the last call and `nowMs`. The first
   * call only starts the clock and answers 0, as does a time earlier than the
   * last one.
   */
  advance(nowMs: f64): i32 {
    if (!this.started || !(nowMs >= this.lastMs)) {
      this.started = true
      this.lastMs = nowMs
      return 0
    }
    this.carry = this.carry + (nowMs - this.lastMs)
    this.lastMs = nowMs
    let steps: i32 = 0
    while (this.carry >= this.stepMs && steps < this.maxSteps) {
      this.carry = this.carry - this.stepMs
      steps = steps + 1
    }
    if (this.carry >= this.stepMs) {
      this.carry = this.carry - this.stepMs * Math.floor(this.carry / this.stepMs)
      // Rounding, or a jump to infinity, can leave the remainder outside a step.
      if (!(this.carry >= 0.0 && this.carry < this.stepMs)) {
        this.carry = 0.0
      }
    }
    return steps
  }

  /** How far into the next step the clock is, from 0 up to but not including 1. */
  alpha(): f64 {
    return this.carry / this.stepMs
  }
}

/** The arrow whose final byte is `b` (`A`–`D`), or `KEY_UNKNOWN`. */
const termArrowKind = (b: i32): i32 => {
  if (b === 65) {
    return KEY_UP
  }
  if (b === 66) {
    return KEY_DOWN
  }
  if (b === 67) {
    return KEY_RIGHT
  }
  return b === 68 ? KEY_LEFT : KEY_UNKNOWN
}

/** The key a single byte below 128 is. */
const termAsciiKind = (b: i32): i32 => {
  if (b === 3) {
    return KEY_CTRL_C
  }
  if (b === 13 || b === 10) {
    return KEY_ENTER
  }
  if (b === 32) {
    return KEY_SPACE
  }
  if (b === 9) {
    return KEY_TAB
  }
  if (b === 127 || b === 8) {
    return KEY_BACKSPACE
  }
  return b < 32 ? KEY_CONTROL : KEY_CHAR
}

/**
 * Decode `bytes` into `events` and answer how many bytes were used.
 * Unless `last` is set, an unfinished sequence at the end is left unused for
 * the caller to hold; with it set, the unfinished start is given up.
 */
const termDecodeKeys = (bytes: u8[], last: boolean, events: KeyEvent[]): i32 => {
  let i: i32 = 0
  while (i < toI32(bytes.length)) {
    if (!(i >= 0)) {
      panic("nish/term: the key decoder stepped back")
    }
    const b: i32 = toI32(bytes[i])
    if (b === TERM_ESC) {
      if (i + 1 >= toI32(bytes.length)) {
        if (!last) {
          return i
        }
        events.push(new KeyEvent(KEY_ESCAPE, b))
        i = i + 1
        continue
      }
      const next: i32 = toI32(bytes[i + 1])
      if (next === 91) {
        let j: i32 = i + 2
        while (j < toI32(bytes.length) && toI32(bytes[j]) >= 32 && toI32(bytes[j]) < 64) {
          j = j + 1
        }
        if (j >= toI32(bytes.length)) {
          if (!last) {
            return i
          }
          events.push(new KeyEvent(KEY_ESCAPE, b))
          i = i + 1
          continue
        }
        const final: i32 = toI32(bytes[j])
        if (final >= 64 && final < 127) {
          events.push(new KeyEvent(termArrowKind(final), final))
          i = j + 1
        } else {
          events.push(new KeyEvent(KEY_ESCAPE, b))
          i = i + 1
        }
        continue
      }
      if (next === 79) {
        if (i + 2 >= toI32(bytes.length)) {
          if (!last) {
            return i
          }
          events.push(new KeyEvent(KEY_ESCAPE, b))
          i = i + 1
          continue
        }
        const final: i32 = toI32(bytes[i + 2])
        if (final >= 64 && final < 127) {
          events.push(new KeyEvent(termArrowKind(final), final))
          i = i + 3
        } else {
          events.push(new KeyEvent(KEY_ESCAPE, b))
          i = i + 1
        }
        continue
      }
      events.push(new KeyEvent(KEY_ESCAPE, b))
      i = i + 1
      continue
    }
    if (b < 128) {
      events.push(new KeyEvent(termAsciiKind(b), b))
      i = i + 1
      continue
    }
    const char: i32 = termUtf8At(bytes, i, last)
    if (char < 0) {
      return i
    }
    events.push(new KeyEvent(KEY_CHAR, char >> 3))
    i = i + (char & 7)
  }
  return toI32(bytes.length)
}

/**
 * The UTF-8 character at `bytes[i]` (a byte of 128 or more), as its code
 * point shifted left 3 with the bytes it used in the low 3 bits; -1 when it
 * is unfinished at the end and `last` is not set, so the caller holds it. A
 * byte that starts no character, a broken sequence, a C1 control, an overlong
 * form, a surrogate or a code point past U+10FFFF is U+FFFD.
 */
const termUtf8At = (bytes: u8[], i: i32, last: boolean): i32 => {
  const b: i32 = toI32(bytes[i])
  // 0xC0 and 0xC1 only ever start an overlong form, and 0xF5 up a code
  // point past U+10FFFF or nothing.
  const width: i32 = b < 194 || b >= 245 ? 1 : termLeadWidth(b)
  if (width === 1) {
    return (TERM_REPLACEMENT << 3) | 1
  }
  let cp: i32 = termLeadBits(b, width)
  let good: i32 = 0
  let stopped: boolean = false
  for (let k: i32 = 1; k < width && !stopped; k++) {
    if (i + k >= toI32(bytes.length)) {
      stopped = true
    } else {
      const c: i32 = toI32(bytes[i + k])
      if (c < 128 || c >= 192) {
        stopped = true
      } else {
        cp = (cp << 6) | (c & 63)
        good = good + 1
      }
    }
  }
  if (good < width - 1) {
    if (!last && i + 1 + good >= toI32(bytes.length)) {
      return -1
    }
    return (TERM_REPLACEMENT << 3) | (1 + good)
  }
  let least: i32 = 65536
  if (width === 2) {
    least = 160
  } else if (width === 3) {
    least = 2048
  }
  const scalar: boolean = cp >= least && cp < 1114112 && !(cp >= 55296 && cp < 57344)
  return ((scalar ? cp : TERM_REPLACEMENT) << 3) | width
}

/** The key event of kind `key` with code `code`, modifiers `mods` and action `action`. */
const termKeyEvent = (key: i32, code: i32, mods: i32, action: i32): TermEvent => {
  const e: TermEvent = new TermEvent(EVENT_KEY)
  e.key = key
  e.code = code
  e.modifiers = mods
  e.action = action
  return e
}

/** The `MOD_` bits of a kitty or xterm modifier parameter `raw` (1 + the bits; caps and num lock dropped), 0 when omitted. */
const termModifiers = (raw: i32): i32 => (raw < 1 ? 0 : (raw - 1) & 63)

/** The `ACTION_` of a kitty event type `raw`: 2 a repeat, 3 a release, anything else a press. */
const termAction = (raw: i32): i32 => {
  if (raw === 2) {
    return ACTION_REPEAT
  }
  return raw === 3 ? ACTION_RELEASE : ACTION_PRESS
}

/**
 * Field `field`, sub-field `sub` of the parameters `bytes[from, to)`, where
 * `;` separates fields and `:` sub-fields (ECMA-48 § 5.4.2; the kitty
 * protocol's `code:shifted ; mods:event ; text`); -1 when it is omitted.
 */
const termCsiField = (bytes: u8[], from: i32, to: i32, field: i32, sub: i32): i32 => {
  let f: i32 = 0
  let s: i32 = 0
  let value: i32 = -1
  for (let k: i32 = from; k < to && k < toI32(bytes.length); k++) {
    const c: i32 = toI32(bytes[k])
    if (c === TERM_SEMICOLON) {
      f = f + 1
      s = 0
    } else if (c === 58) {
      s = s + 1
    } else if (c >= TERM_DIGIT_0 && c < TERM_DIGIT_0 + 10 && f === field && s === sub) {
      // Past eight digits a number is no parameter a terminal sends; it stops growing.
      if (value < 0) {
        value = c - TERM_DIGIT_0
      } else if (value < 10000000) {
        value = value * 10 + (c - TERM_DIGIT_0)
      }
    }
  }
  return value
}

/** The first sub-field of each field of the parameters `bytes[from, to)`, an omitted one as 0. */
const termCsiParams = (bytes: u8[], from: i32, to: i32): i32[] => {
  const params: i32[] = []
  if (from >= to) {
    return params
  }
  let fields: i32 = 1
  for (let k: i32 = from; k < to && k < toI32(bytes.length); k++) {
    if (toI32(bytes[k]) === TERM_SEMICOLON) {
      fields = fields + 1
    }
  }
  for (let f: i32 = 0; f < fields; f++) {
    const v: i32 = termCsiField(bytes, from, to, f, 0)
    params.push(v < 0 ? 0 : v)
  }
  return params
}

/** The string of UTF-8 `bytes[from, to)`, as `termBytesText` makes one. */
const termBytesRange = (bytes: u8[], from: i32, to: i32): string => {
  const part: u8[] = []
  for (let k: i32 = from; k < to && k < toI32(bytes.length); k++) {
    part.push(bytes[k])
  }
  return termBytesText(part, toI32(part.length))
}

/** Append code point `cp` to `out` as UTF-8; one that is no scalar value goes as U+FFFD. */
const termPushUtf8 = (out: u8[], cp: i32): void => {
  const c: i32 = cp >= 0 && cp < 1114112 && !(cp >= 55296 && cp < 57344) ? cp : TERM_REPLACEMENT
  if (c < 128) {
    out.push(toU8(c))
  } else if (c < 2048) {
    out.push(toU8((c >> 6) | 192))
    out.push(toU8((c & 63) | 128))
  } else if (c < 65536) {
    out.push(toU8((c >> 12) | 224))
    out.push(toU8(((c >> 6) & 63) | 128))
    out.push(toU8((c & 63) | 128))
  } else {
    out.push(toU8((c >> 18) | 240))
    out.push(toU8(((c >> 12) & 63) | 128))
    out.push(toU8(((c >> 6) & 63) | 128))
    out.push(toU8((c & 63) | 128))
  }
}

/**
 * The key a kitty `ESC [ code u` names (kitty keyboard protocol, "An
 * overview"): Enter, Tab, Backspace, Escape and Space by their codes, another
 * control below 32 as itself, a key in the Private Use Area (57344–63743,
 * kitty's functional keys: keypad, media, modifiers, F13 up) as `KEY_UNKNOWN`,
 * and any other code point as the character.
 */
const termKittyKind = (code: i32): i32 => {
  if (code === 13) {
    return KEY_ENTER
  }
  if (code === 9) {
    return KEY_TAB
  }
  if (code === 127 || code === 8) {
    return KEY_BACKSPACE
  }
  if (code === TERM_ESC) {
    return KEY_ESCAPE
  }
  if (code === TERM_SPACE) {
    return KEY_SPACE
  }
  if (code < 0 || (code >= 57344 && code < 63744) || code >= 1114112) {
    return KEY_UNKNOWN
  }
  return code < TERM_SPACE ? KEY_CONTROL : KEY_CHAR
}

/**
 * The key `ESC [ n ~` names (xterm ctlseqs, "PC-Style Function Keys"; the
 * kitty protocol keeps them): 1 and 7 Home, 2 Insert, 3 Delete, 4 and 8 End,
 * 5 Page Up, 6 Page Down, 11–15 F1–F5, 17–21 F6–F10, 23 F11, 24 F12.
 */
const termTildeKind = (n: i32): i32 => {
  if (n === 1 || n === 7) {
    return KEY_HOME
  }
  if (n === 4 || n === 8) {
    return KEY_END
  }
  if (n === 2) {
    return KEY_INSERT
  }
  if (n === 3) {
    return KEY_DELETE
  }
  if (n === 5) {
    return KEY_PAGE_UP
  }
  if (n === 6) {
    return KEY_PAGE_DOWN
  }
  if (n >= 11 && n <= 15) {
    return KEY_F1 + (n - 11)
  }
  if (n >= 17 && n <= 21) {
    return KEY_F6 + (n - 17)
  }
  if (n === 23 || n === 24) {
    return KEY_F11 + (n - 23)
  }
  return KEY_UNKNOWN
}

/**
 * The key a letter final byte names, `ESC [ 1 ; m X` or `ESC O X` (xterm
 * ctlseqs, "PC-Style Function Keys"): A–D the arrows, H Home, F End, P–S
 * F1–F4.
 */
const termLetterKind = (f: i32): i32 => {
  if (f === 72) {
    return KEY_HOME
  }
  if (f === 70) {
    return KEY_END
  }
  if (f >= 80 && f <= 83) {
    return KEY_F1 + (f - 80)
  }
  return termArrowKind(f)
}

/** Whether key event `e` is Ctrl-C: byte 3, or kitty's `c` with Ctrl alone. */
const termIsCtrlC = (e: TermEvent): boolean =>
  e.key === KEY_CTRL_C || (e.key === KEY_CHAR && e.code === 99 && e.modifiers === MOD_CTRL)

/** One number for a key `KeyState` tracks: its kind above bit 21, and the code below for the kinds a code tells apart, a capital folded to its small letter. */
const termKeyId = (key: i32, code: i32): i32 => {
  let c: i32 = key === KEY_CHAR || key === KEY_CONTROL || key === KEY_UNKNOWN ? code : 0
  if (key === KEY_CHAR && c >= 65 && c <= 90) {
    c = c + 32
  }
  return (key << 21) | (c & 2097151)
}

/** The byte at `k` of the paste terminator `ESC [ 2 0 1 ~` (xterm ctlseqs, "Bracketed Paste Mode"). */
const termPasteEndByte = (k: i32): i32 => {
  if (k === 0) {
    return TERM_ESC
  }
  if (k === 1) {
    return TERM_BRACKET
  }
  if (k === 5) {
    return 126
  }
  if (k === 3) {
    return TERM_DIGIT_0
  }
  return k === 2 ? 50 : 49
}

/**
 * Carry a bracketed paste on from `bytes[i]`: append to the paste up to its
 * terminator and answer where decoding resumes after it, with the paste as
 * one `EVENT_PASTE`. A terminator cut off at the end is held unless `last`;
 * without one, every byte joins the paste. ESC, newlines and anything else
 * inside are text, never keys.
 */
const termDecodePaste = (d: KeyDecoder, bytes: u8[], i: i32, last: boolean, events: TermEvent[]): i32 => {
  const n: i32 = toI32(bytes.length)
  let k: i32 = i
  while (k >= 0 && k < toI32(bytes.length)) {
    let m: i32 = 0
    while (m < 6 && k + m < n && toI32(bytes[k + m]) === termPasteEndByte(m)) {
      m = m + 1
    }
    if (m === 6 || (m > 0 && k + m === n && !last)) {
      break
    }
    d.pasteBytes.push(bytes[k])
    k = k + 1
  }
  if (k >= n || k + 6 > n) {
    return k
  }
  const e: TermEvent = new TermEvent(EVENT_PASTE)
  e.text = termBytesText(d.pasteBytes, toI32(d.pasteBytes.length))
  events.push(e)
  d.pasting = false
  d.pasteBytes = []
  return k + 6
}

/**
 * The mouse report `ESC [ < b ; x ; y M` (press) or `m` (release), SGR mode
 * 1006 or, in pixels, 1016 (xterm ctlseqs, "Mouse Tracking", "Extended
 * coordinates"). In `b` the low two bits are the button (3 is none), +4
 * Shift, +8 Alt, +16 Ctrl, +32 a move, +64 the wheel and +128 buttons 8–11;
 * `x` and `y` count from 1, made to count from 0.
 */
const termMouseEvent = (d: KeyDecoder, bytes: u8[], from: i32, to: i32, final: i32): TermEvent => {
  const b: i32 = termCsiField(bytes, from, to, 0, 0)
  const x: i32 = termClamp(termCsiField(bytes, from, to, 1, 0) - 1, 0, 2147483646)
  const y: i32 = termClamp(termCsiField(bytes, from, to, 2, 0) - 1, 0, 2147483646)
  const e: TermEvent = new TermEvent(EVENT_MOUSE)
  const bits: i32 = b < 0 ? 3 : b
  const none: i32 = 0
  e.modifiers =
    ((bits & 4) !== 0 ? MOD_SHIFT : none) |
    ((bits & 8) !== 0 ? MOD_ALT : none) |
    ((bits & 16) !== 0 ? MOD_CTRL : none)
  const low: i32 = bits & 3
  if ((bits & 128) !== 0) {
    e.button = MOUSE_BUTTON_8 + low
  } else if ((bits & 64) !== 0) {
    e.button = MOUSE_WHEEL_UP + low
  } else {
    e.button = low === 3 ? MOUSE_NONE : low + 1
  }
  if ((bits & 32) !== 0) {
    e.action = ACTION_MOVE
  } else {
    e.action = final === 77 ? ACTION_PRESS : ACTION_RELEASE
  }
  if (!d.pixelMouse) {
    e.x = x
    e.y = y
    return e
  }
  e.px = x
  e.py = y
  e.x = d.cellWidthPx > 0 ? (x / d.cellWidthPx) | 0 : -1
  e.y = d.cellHeightPx > 0 ? (y / d.cellHeightPx) | 0 : -1
  return e
}

/** A reply opened by `introducer`, with `prefix`, `params`, `intermediate`, final byte `reply` and `text`. */
const termReplyEvent = (
  introducer: i32,
  prefix: i32,
  params: i32[],
  intermediate: i32,
  reply: i32,
  text: string
): TermEvent => {
  const e: TermEvent = new TermEvent(EVENT_REPLY)
  e.introducer = introducer
  e.prefix = prefix
  e.params = params
  e.intermediate = intermediate
  e.reply = reply
  e.text = text
  return e
}

/**
 * The event of the complete control sequence `ESC [ prefix params
 * intermediate final`, its parameters in `bytes[from, to)`, appended to
 * `events` — or, for `ESC [ 200 ~`, the start of a paste, and for a stray
 * `ESC [ 201 ~`, nothing.
 */
const termCsiEvent = (
  d: KeyDecoder,
  bytes: u8[],
  from: i32,
  to: i32,
  prefix: i32,
  intermediate: i32,
  final: i32,
  events: TermEvent[]
): void => {
  if (prefix === 60 && (final === 77 || final === 109)) {
    events.push(termMouseEvent(d, bytes, from, to, final))
    return
  }
  const first: i32 = termCsiField(bytes, from, to, 0, 0)
  // DA1 `ESC [ ? … c`, DA2 `ESC [ > … c`, DECRPM `ESC [ ? n ; v $ y`, kitty's
  // flags `ESC [ ? f u`, XTSMGRAPHICS `ESC [ ? i ; s ; v S`, DECXCPR: anything
  // with a private marker or an intermediate is an answer, never a key. DSR
  // `ESC [ 0 n` and the window reports `ESC [ 4|6|8 ; a ; b t` have no marker
  // but a final no key uses (xterm ctlseqs, "Functions using CSI").
  const cpr: boolean = final === 82 && d.cprOutstanding > 0
  if (prefix !== 0 || intermediate !== 0 || final === 110 || final === 116 || cpr) {
    if (cpr) {
      d.cprOutstanding = d.cprOutstanding - 1
    }
    events.push(termReplyEvent(TERM_BRACKET, prefix, termCsiParams(bytes, from, to), intermediate, final, ""))
    return
  }
  // Focus in `ESC [ I` and out `ESC [ O`, mode 1004 (xterm ctlseqs, "FocusIn/FocusOut").
  if ((final === 73 || final === 79) && from === to) {
    const e: TermEvent = new TermEvent(EVENT_FOCUS)
    e.gained = final === 73
    events.push(e)
    return
  }
  if (final === 126 && (first === 200 || first === 201)) {
    d.pasting = first === 200
    d.pasteBytes = []
    return
  }
  const mods: i32 = termModifiers(termCsiField(bytes, from, to, 1, 0))
  const action: i32 = termAction(termCsiField(bytes, from, to, 1, 1))
  // kitty `ESC [ code ; mods:event ; text u` (kitty keyboard protocol,
  // "Key events"), and xterm's modifyOtherKeys `ESC [ 27 ; mods ; code ~`.
  if (final === 117 || (final === 126 && first === 27)) {
    const code: i32 = final === 117 ? first : termCsiField(bytes, from, to, 2, 0)
    const e: TermEvent = termKeyEvent(termKittyKind(code), code < 0 ? final : code, mods, action)
    if (final === 117) {
      const text: u8[] = []
      for (let s: i32 = 0; termCsiField(bytes, from, to, 2, s) >= 0; s++) {
        termPushUtf8(text, termCsiField(bytes, from, to, 2, s))
      }
      e.text = termBytesText(text, toI32(text.length))
    }
    events.push(e)
    return
  }
  // Shift-Tab, `ESC [ Z` (xterm ctlseqs, "CBT").
  if (final === 90) {
    events.push(termKeyEvent(KEY_TAB, 9, mods | MOD_SHIFT, action))
    return
  }
  const kind: i32 = final === 126 ? termTildeKind(first) : termLetterKind(final)
  const e: TermEvent = termKeyEvent(kind, final, mods, action)
  if (kind === KEY_UNKNOWN) {
    e.params = termCsiParams(bytes, from, to)
  }
  events.push(e)
}

/**
 * Decode the control sequence at `bytes[i]` (`ESC [`) into `events` and answer
 * where decoding resumes, or -1 when it is unfinished at the end and `last`
 * is not set. Parameter and intermediate bytes run 32–63 and a final byte
 * 64–126 (ECMA-48 § 5.4); a sequence broken off by another byte is an ESC
 * key, and the bytes after it keys of their own, as `feed` has it.
 */
const termDecodeCsi = (d: KeyDecoder, bytes: u8[], i: i32, last: boolean, events: TermEvent[]): i32 => {
  const n: i32 = toI32(bytes.length)
  let j: i32 = i + 2
  while (j < n && toI32(bytes[j]) >= 32 && toI32(bytes[j]) < 64) {
    j = j + 1
  }
  if (j >= n && !last) {
    return -1
  }
  const final: i32 = j < n ? toI32(bytes[j]) : 0
  if (!(final >= 64 && final < 127)) {
    events.push(termKeyEvent(KEY_ESCAPE, TERM_ESC, 0, ACTION_PRESS))
    return i + 1
  }
  // The Linux console's F1–F5, `ESC [ [ A` to `ESC [ [ E` (console_codes(4)).
  if (final === TERM_BRACKET && j === i + 2) {
    if (j + 1 >= n && !last) {
      return -1
    }
    const f: i32 = j + 1 < n ? toI32(bytes[j + 1]) : 0
    if (f >= 65 && f <= 69) {
      events.push(termKeyEvent(KEY_F1 + (f - 65), f, 0, ACTION_PRESS))
      return j + 2
    }
  }
  let from: i32 = i + 2
  let prefix: i32 = 0
  if (from < j && toI32(bytes[from]) >= 60) {
    prefix = toI32(bytes[from])
    from = from + 1
  }
  let to: i32 = from
  while (to < j && termByte(bytes, to) >= TERM_DIGIT_0) {
    to = to + 1
  }
  termCsiEvent(d, bytes, from, to, prefix, to < j ? toI32(bytes[j - 1]) : 0, final, events)
  return j + 1
}

/**
 * Decode the control string at `bytes[i]` — DCS `ESC P`, APC `ESC _`, OSC
 * `ESC ]`, PM `ESC ^` or SOS `ESC X` — into one `EVENT_REPLY`, and answer
 * where decoding resumes. It ends at ST, `ESC \`, or BEL (ECMA-48 § 8.3.143;
 * xterm ctlseqs, "Operating System Commands"). Unfinished at the end it is -1
 * unless `last`, when it is dropped; an ESC inside that starts no ST breaks
 * it off, and decoding resumes at that ESC. A DCS reads as a CSI does then
 * carries its data in `text`: XTVERSION `ESC P > | name ST`, DECRQSS
 * `ESC P 1 $ r … ST`. An APC's first byte is its `reply` (kitty graphics
 * `ESC _ G … ST`); an OSC's number is its one param and the rest its text.
 */
const termDecodeString = (bytes: u8[], i: i32, last: boolean, events: TermEvent[]): i32 => {
  const n: i32 = toI32(bytes.length)
  const introducer: i32 = toI32(bytes[i + 1])
  let end: i32 = i + 2
  while (end < n && toI32(bytes[end]) !== 7 && toI32(bytes[end]) !== TERM_ESC) {
    end = end + 1
  }
  if (end + (end < n && toI32(bytes[end]) === TERM_ESC ? 1 : 0) >= n) {
    return last ? n : -1
  }
  let resume: i32 = end + 1
  if (toI32(bytes[end]) === TERM_ESC) {
    if (toI32(bytes[end + 1]) !== 92) {
      return end
    }
    resume = end + 2
  }
  const start: i32 = i + 2
  if (introducer === 95) {
    events.push(
      termReplyEvent(
        introducer,
        0,
        [],
        0,
        start < end ? toI32(bytes[start]) : 0,
        termBytesRange(bytes, start + 1, end)
      )
    )
    return resume
  }
  if (introducer === 93) {
    let semi: i32 = start
    while (semi < end && toI32(bytes[semi]) !== TERM_SEMICOLON) {
      semi = semi + 1
    }
    events.push(
      termReplyEvent(
        introducer,
        0,
        termCsiParams(bytes, start, semi),
        0,
        0,
        termBytesRange(bytes, semi + 1, end)
      )
    )
    return resume
  }
  if (introducer !== 80) {
    events.push(termReplyEvent(introducer, 0, [], 0, 0, termBytesRange(bytes, start, end)))
    return resume
  }
  let from: i32 = start
  let prefix: i32 = 0
  if (from < end && toI32(bytes[from]) >= 60 && toI32(bytes[from]) < 64) {
    prefix = toI32(bytes[from])
    from = from + 1
  }
  let to: i32 = from
  while (to < end && toI32(bytes[to]) >= TERM_DIGIT_0 && toI32(bytes[to]) < 64) {
    to = to + 1
  }
  let f: i32 = to
  while (f < end && toI32(bytes[f]) >= 32 && toI32(bytes[f]) < TERM_DIGIT_0) {
    f = f + 1
  }
  const intermediate: i32 = f > to ? toI32(bytes[f - 1]) : 0
  const final: i32 = f < end ? toI32(bytes[f]) : 0
  events.push(
    termReplyEvent(
      introducer,
      prefix,
      termCsiParams(bytes, from, to),
      intermediate,
      final,
      termBytesRange(bytes, f + 1, end)
    )
  )
  return resume
}

/** The byte at `k` of `bytes`, or -1 past either end. */
const termByte = (bytes: u8[], k: i32): i32 => (k >= 0 && k < toI32(bytes.length) ? toI32(bytes[k]) : -1)

/** Whether `b`, after an ESC, opens a control string: DCS `P`, SOS `X`, OSC `]`, PM `^` or APC `_`. */
const termOpensString = (b: i32): boolean => b === 80 || b === 88 || b === 93 || b === 94 || b === 95

/**
 * Decode `bytes` into `events` for `feedEvents` and `pollEvents`, and answer
 * how many bytes were used. Unless `last` is set, an unfinished sequence at
 * the end is left unused for the caller to hold; with it set, the unfinished
 * start is given up. A paste carries on across calls in `d`.
 */
const termDecodeEvents = (d: KeyDecoder, bytes: u8[], last: boolean, events: TermEvent[]): i32 => {
  const n: i32 = toI32(bytes.length)
  let i: i32 = 0
  while (i < toI32(bytes.length)) {
    if (!(i >= 0)) {
      panic("nish/term: the event decoder stepped back")
    }
    let next: i32 = i + 1
    const b: i32 = toI32(bytes[i])
    if (d.pasting) {
      next = termDecodePaste(d, bytes, i, last, events)
      if (next < n && d.pasting) {
        return next
      }
    } else if (b === TERM_ESC && i + 1 >= n) {
      if (!last) {
        return i
      }
      events.push(termKeyEvent(KEY_ESCAPE, b, 0, ACTION_PRESS))
    } else if (b === TERM_ESC) {
      const after: i32 = termByte(bytes, i + 1)
      if (after === TERM_BRACKET) {
        next = termDecodeCsi(d, bytes, i, last, events)
      } else if (termOpensString(after)) {
        next = termDecodeString(bytes, i, last, events)
      } else if (after === 79 && i + 2 >= n && !last) {
        next = -1
      } else if (after === 79 && termByte(bytes, i + 2) >= 64 && termByte(bytes, i + 2) < 127) {
        // SS3 `ESC O X`: the arrows, Home, End and F1–F4 in application
        // mode, and keypad Enter `ESC O M` (xterm ctlseqs, "PC-Style Function Keys").
        const f: i32 = termByte(bytes, i + 2)
        events.push(
          termKeyEvent(f === 77 ? KEY_ENTER : termLetterKind(f), f === 77 ? 13 : f, 0, ACTION_PRESS)
        )
        next = i + 3
      } else if (after !== TERM_ESC && after !== 79 && after < 128) {
        // Alt held with a key sends ESC before it (xterm's metaSendsEscape).
        events.push(termKeyEvent(termAsciiKind(after), after, MOD_ALT, ACTION_PRESS))
        next = i + 2
      } else {
        events.push(termKeyEvent(KEY_ESCAPE, b, 0, ACTION_PRESS))
      }
      if (next < 0) {
        return i
      }
    } else if (b < 128) {
      events.push(termKeyEvent(termAsciiKind(b), b, 0, ACTION_PRESS))
    } else {
      const char: i32 = termUtf8At(bytes, i, last)
      if (char < 0) {
        return i
      }
      events.push(termKeyEvent(KEY_CHAR, char >> 3, 0, ACTION_PRESS))
      next = i + (char & 7)
    }
    i = next
  }
  return n
}
