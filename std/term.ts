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

/** The escape byte that starts every control sequence. */
const TERM_ESC: i32 = 27

/** The space a blank cell holds. */
const TERM_SPACE: i32 = 32

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

/** The SGR base of a foreground colour: 38 sets one, 39 is the default. */
const TERM_SGR_FOREGROUND: i32 = 30

/** The SGR base of a background colour: 48 sets one, 49 is the default. */
const TERM_SGR_BACKGROUND: i32 = 40

/** A front-buffer code point no glyph has, so the cell is sent on the next flush. */
const TERM_UNSENT: i32 = -1

/** A style the terminal is not known to be in, so the next cell sends its own in full. */
const TERM_STYLE_UNKNOWN: i32 = -2

/** The most bytes one cell can add to a flush: a move, a full SGR and a 4-byte glyph, rounded up. */
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

  /**
   * A `width × height` screen of blank cells in the terminal's colours, none
   * of them sent yet, so the first `flush` draws them all. With `palette256`
   * set, every colour is sent as its nearest 256-colour index (`paletteIndex`).
   */
  constructor(width: i32, height: i32, palette256: boolean) {
    this.width = width < 0 ? 0 : width
    this.height = height < 0 ? 0 : height
    this.palette256 = palette256
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
    this.out.fill(toU8(0))
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

  /** Draw code point `glyph` at column `x`, row `y`; a cell off the screen is not drawn. */
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
    this.attrs[i] = attrs
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

  /** Append code point `cp` as UTF-8; a negative one, which no cell holds, as U+FFFD. */
  putGlyph(cp: i32): void {
    if (cp >= 0 && cp < 128) {
      this.put(cp)
    } else if (cp >= 128 && cp < 2048) {
      this.put((cp >> 6) | 192)
      this.put((cp & 63) | 128)
    } else if (cp >= 65536 && cp < 1114112) {
      this.put((cp >> 18) | 240)
      this.put(((cp >> 12) & 63) | 128)
      this.put(((cp >> 6) & 63) | 128)
      this.put((cp & 63) | 128)
    } else {
      const c: i32 = cp >= 2048 && cp < 65536 ? cp : TERM_REPLACEMENT
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
   * `ESC [ 0 m`, so what the caller writes next starts plain.
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
              glyphs[k] >= 128 ||
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

  /** Draw a line from `x0`, `y0` to `x1`, `y1`, both ends included (Bresenham's). */
  line(x0: i32, y0: i32, x1: i32, y1: i32, colour: i32): void {
    const dx: i32 = x1 > x0 ? x1 - x0 : x0 - x1
    const dy: i32 = y1 > y0 ? y0 - y1 : y1 - y0
    const sx: i32 = x0 < x1 ? 1 : -1
    const sy: i32 = y0 < y1 ? 1 : -1
    let err: i32 = dx + dy
    let x: i32 = x0
    let y: i32 = y0
    while (true) {
      this.setPixel(x, y, colour)
      if (x === x1 && y === y1) {
        return
      }
      const twice: i32 = 2 * err
      if (twice >= dy) {
        err = err + dy
        x = x + sx
      }
      if (twice <= dx) {
        err = err + dx
        y = y + sy
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
 */
export class KeyDecoder {
  /** How long a held ESC waits for the rest of a sequence, in milliseconds. */
  escapeTimeoutMs: f64
  /** The bytes of an unfinished sequence, carried to the next call. */
  pending: u8[]
  /** When the first held byte arrived. */
  pendingSince: f64

  /** A decoder that gives up on an unfinished sequence after `escapeTimeoutMs` (25–50 is usual). */
  constructor(escapeTimeoutMs: f64) {
    this.escapeTimeoutMs = escapeTimeoutMs
    this.pending = []
    this.pendingSince = 0.0
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
    const n: i32 = termClamp(count, 0, toI32(bytes.length))
    if (held + n === 0) {
      return events
    }
    const work: u8[] = new Array<u8>(held + n)
    const pending: u8[] = this.pending
    for (let k: i32 = 0; k < toI32(pending.length) && k < toI32(work.length); k++) {
      work[k] = pending[k]
    }
    for (let k: i32 = 0; k < n && k < toI32(bytes.length); k++) {
      work[held + k] = bytes[k]
    }
    const used: i32 = termDecodeKeys(work, false, events)
    const rest: u8[] = []
    for (let k: i32 = used; k < held + n; k++) {
      if (!(k >= 0 && k < toI32(work.length))) {
        panic("nish/term: the key decoder used more bytes than it was given")
      }
      rest.push(work[k])
    }
    if (held === 0 && toI32(rest.length) > 0) {
      this.pendingSince = nowMs
    }
    this.pending = rest
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
        events.push(new KeyEvent(termArrowKind(final), final))
        i = i + 3
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
    // 0xC0 and 0xC1 only ever start an overlong form, and 0xF8 up start nothing.
    const width: i32 = b < 194 || b >= 248 ? 1 : termLeadWidth(b)
    if (width === 1) {
      events.push(new KeyEvent(KEY_CHAR, TERM_REPLACEMENT))
      i = i + 1
      continue
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
        return i
      }
      events.push(new KeyEvent(KEY_CHAR, TERM_REPLACEMENT))
      i = i + 1 + good
      continue
    }
    events.push(new KeyEvent(KEY_CHAR, cp))
    i = i + width
  }
  return toI32(bytes.length)
}
