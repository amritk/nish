/**
 * `nish/term-pixels` — a framebuffer of pixels, and the encoders that draw it
 * to a terminal with the best backend the terminal has: kitty graphics, Sixel,
 * half-block cells or ASCII.
 *
 * A program draws `0xRRGGBB` pixels into a `Framebuffer` and never thinks about
 * the terminal; `std/term-io` picks the backend and calls one encoder per frame.
 * Everything here is pure: no capability, no I/O, and the bytes are the same
 * natively and under Node, because the kitty and Sixel output is ASCII and the
 * cell drawers go through `Screen`, which already is.
 *
 * - `Framebuffer(width, height)` holds the pixels, with `set`, `get`, `fill`,
 *   `clear` and `resize`. `scaleFramebuffer(src, divisor, dst)` shrinks one by
 *   an integer divisor, nearest-neighbour, for the refresh controller's
 *   resolution downgrade.
 * - `GRAPHICS_ASCII`, `GRAPHICS_HALFBLOCK`, `GRAPHICS_SIXEL` and
 *   `GRAPHICS_KITTY` name the backends, numbered from worst to best so that a
 *   capability and a cap combine with `Math.min`.
 * - `fitFramebuffer(fbW, fbH, cols, rows, cellW, cellH, backend)` answers the
 *   `PixelRect` the image is drawn in: the cells it covers, centred in a
 *   `cols × rows` area (letterboxed), and its size in the backend's pixels,
 *   keeping the framebuffer's aspect ratio.
 * - `kittyFrame(fb, rect, imageId, out)` writes the kitty graphics commands for
 *   one frame into a `PixelBytes`; `KITTY_TRANSFER_DIRECT` is its transfer.
 * - `sixelFrame(fb, rect, dither, out)` writes one Sixel image, in the fixed
 *   palette `SIXEL_REGISTERS` counts, optionally ordered-dithered.
 * - `drawHalfBlocks(fb, canvas, rect)` and `drawAscii(fb, screen, rect, colors)`
 *   draw onto the cells of a `Canvas` or a `Screen` from `nish/term`, whose own
 *   diff makes an unchanged cell cost nothing at `flush`.
 *
 * Every encoder samples the framebuffer nearest-neighbour onto the rect's
 * pixels; none of them clears the letterbox around the rect, which is the
 * caller's.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 */
import { base64EncodeInto } from "nish/base64"
import { COLOR_DEFAULT, ATTR_NONE, Canvas, Screen, moveCursor } from "nish/term"

/** Text cells, one luminance character each: the Linux console's backend. */
export const GRAPHICS_ASCII: i32 = 0

/** Two pixels a cell, through `Canvas`'s half blocks. */
export const GRAPHICS_HALFBLOCK: i32 = 1

/** DEC Sixel, in the terminal's own pixels. */
export const GRAPHICS_SIXEL: i32 = 2

/** The kitty graphics protocol, in the terminal's own pixels. */
export const GRAPHICS_KITTY: i32 = 3

/**
 * kitty's direct transfer, `t=d`: the pixels travel base64-encoded inside the
 * escape codes themselves. It is the only transfer built. The protocol's
 * shared-memory transfer (`t=s`, a POSIX shm object named in the payload) and
 * zlib compression (`o=z`) are the seam for a local terminal and a slow link;
 * a future `KITTY_TRANSFER_SHM` would take its own value here and its own
 * branch in `kittyFrame`, which today has none to choose.
 */
export const KITTY_TRANSFER_DIRECT: i32 = 0

/** The Sixel registers the fixed palette uses: 6 reds × 7 greens × 6 blues. */
export const SIXEL_REGISTERS: i32 = 252

/** The pixel size of a cell `fitFramebuffer` assumes when the terminal did not say: VGA's 8×16. */
const PIXELS_CELL_W: i32 = 8
const PIXELS_CELL_H: i32 = 16

/** The base64 characters in one kitty chunk, the most the protocol allows. */
const PIXELS_KITTY_CHUNK: i32 = 4096

/** The pixel bytes one chunk carries: 4096 characters are 1024 groups of three. */
const PIXELS_KITTY_RAW: i32 = 3072

/** ESC, which opens every escape this module writes. */
const PIXELS_ESC: i32 = 27

// The rest of the bytes this module writes, named because a bare literal is an
// f64 under `--number-mode f64` and cannot be passed where an i32 is wanted.

/** One, as the i32 a byte count and a bit start from. */
const PIXELS_ONE: i32 = 1

/** `\`, which follows ESC to end an APC or a DCS (ECMA-48 ST). */
const PIXELS_BACKSLASH: i32 = 92

/** `0`, the first decimal digit. */
const PIXELS_DIGIT_0: i32 = 48

/** `;`, between the numbers of raster attributes and colour introducers. */
const PIXELS_SEMICOLON: i32 = 59

/** `!`, the Sixel repeat introducer (DECGRI). */
const SIXEL_REPEAT: i32 = 33

/** `?`, the sixel with no pixels set; a sixel is this plus its six bits. */
const SIXEL_BLANK: i32 = 63

/** `#`, the Sixel colour introducer (DECGCI). */
const SIXEL_COLOUR: i32 = 35

/** `$`, the Sixel carriage return (DECGCR): back to the band's first column. */
const SIXEL_RETURN: i32 = 36

/** `-`, the Sixel next line (DECGNL): down to the next six-pixel band. */
const SIXEL_NEXT_LINE: i32 = 45

/** The 4×4 Bayer matrix, row by row, one hex digit a threshold: the order of ordered dithering. */
const PIXELS_BAYER: string = "082ac4e63b19f7d5"

/** The luminance ramp `drawAscii` draws with, darkest first. */
const PIXELS_RAMP: string = " .:-=+*#%@"

/** xterm's 16 standard colours in their SGR order, six hex digits each. */
const PIXELS_ANSI16: string =
  "000000cd000000cd00cdcd000000eecd00cd00cdcde5e5e57f7f7fff000000ff00ffff005c5cffff00ff00ffffffffff"

/** The value of the hex digits `text[at..at+count)`. */
const pixelsHex = (text: string, at: i32, count: i32): i32 => {
  let v: i32 = 0
  for (let i: i32 = at; i < at + count; i++) {
    const c: i32 = toI32(text.charCodeAt(i))
    v = (v << 4) | (c >= 97 ? c - 87 : c - 48)
  }
  return v
}

/** Panic, as `who`, unless `width × height` is a size an array of pixels can have. */
const pixelsCheckSize = (who: string, width: i32, height: i32): void => {
  if (width < 0 || height < 0) {
    panic(`${who}: a negative size`)
  }
  if (width > 0 && height > ((2147483647 / width) | 0)) {
    panic(`${who}: more than 2^31 - 1 pixels`)
  }
}

/** A `width × height` grid of `0xRRGGBB` pixels, row by row, all black when made. */
export class Framebuffer {
  /** Pixels across. */
  width: i32
  /** Pixels down. */
  height: i32
  /** One colour per pixel, `y * width + x`. */
  pixels: i32[]

  /** A black framebuffer of `width × height`; a negative size, or more than 2^31 - 1 pixels, panics. */
  constructor(width: i32, height: i32) {
    pixelsCheckSize("Framebuffer", width, height)
    this.width = width
    this.height = height
    this.pixels = new Array<i32>(width * height)
    this.pixels.fill(0)
  }

  /** Make the framebuffer `width × height` and black; the array is replaced only when the size changes. */
  resize(width: i32, height: i32): void {
    pixelsCheckSize("Framebuffer.resize", width, height)
    if (width !== this.width || height !== this.height) {
      this.width = width
      this.height = height
      this.pixels = new Array<i32>(width * height)
    }
    this.pixels.fill(0)
  }

  /** Set the pixel at `x`, `y` to `colour`'s low 24 bits; a pixel off the framebuffer is not drawn. */
  set(x: i32, y: i32, colour: i32): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return
    }
    this.pixels[y * this.width + x] = colour & 0xffffff
  }

  /** The colour of the pixel at `x`, `y`, or black off the framebuffer. */
  get(x: i32, y: i32): i32 {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return 0
    }
    return this.pixels[y * this.width + x]
  }

  /** Set every pixel to `colour`'s low 24 bits. */
  fill(colour: i32): void {
    this.pixels.fill(colour & 0xffffff)
  }

  /** Set every pixel to black. */
  clear(): void {
    this.pixels.fill(0)
  }
}

/**
 * Shrink `src` by `divisor` into `dst`, which is resized to
 * `ceil(width / divisor) × ceil(height / divisor)`: each pixel of `dst` is the
 * top-left pixel of its `divisor × divisor` block, nearest-neighbour, so a
 * frame costs a quarter or a sixteenth of the bytes at divisor 2 or 4. A
 * divisor below 1 panics; 1 copies. `dst` must be another framebuffer than
 * `src`, which resizing it would blank.
 */
export const scaleFramebuffer = (src: Framebuffer, divisor: i32, dst: Framebuffer): void => {
  if (divisor < 1) {
    panic("scaleFramebuffer: a divisor below 1")
  }
  const w: i32 = pixelsCeilDiv(src.width, divisor)
  const h: i32 = pixelsCeilDiv(src.height, divisor)
  dst.resize(w, h)
  for (let y: i32 = 0; y < h; y++) {
    const from: i32 = y * divisor * src.width
    for (let x: i32 = 0; x < w; x++) {
      dst.pixels[y * w + x] = src.pixels[from + x * divisor]
    }
  }
}

/**
 * Where a framebuffer is drawn: the cells it covers and its size in the
 * backend's pixels. `width` and `height` are terminal pixels for kitty and
 * Sixel, half-cell pixels for half-blocks (`cols` across, up to `rows * 2`
 * down) and cells for ASCII (`cols × rows`).
 */
export class PixelRect {
  /** The first column covered, from 0. */
  col: i32
  /** The first row covered, from 0. */
  row: i32
  /** The columns covered. */
  cols: i32
  /** The rows covered. */
  rows: i32
  /** The image's width in the backend's pixels. */
  width: i32
  /** The image's height in the backend's pixels. */
  height: i32
  /** The backend's pixels per framebuffer pixel across; ASCII's rows are half that down. */
  scale: f64

  /** A rect of the given cells and size; `fitFramebuffer` is how one is usually made. */
  constructor(col: i32, row: i32, cols: i32, rows: i32, width: i32, height: i32, scale: f64) {
    this.col = col
    this.row = row
    this.cols = cols
    this.rows = rows
    this.width = width
    this.height = height
    this.scale = scale
  }
}

/** `a / b` rounded up, for `a >= 0` and `b > 0`. */
const pixelsCeilDiv = (a: i32, b: i32): i32 => (a === 0 ? 0 : (((a - 1) / b) | 0) + 1)

/**
 * The rect a `fbW × fbH` framebuffer is drawn in on a `cols × rows` area of
 * cells `cellW × cellH` pixels each, by `backend` (a `GRAPHICS_` constant): as
 * large as fits with the framebuffer's aspect ratio kept, and centred, so the
 * spare cells on two sides are the letterbox. The rect starts at column and
 * row 0 of the area; the caller adds the area's own offset.
 *
 * kitty and Sixel measure in the cell's pixels, taken as 8×16 when `cellW` or
 * `cellH` is not positive (the terminal did not answer `CSI 16 t`). Half-blocks
 * and ASCII take a cell as one pixel wide and two tall, the shape of a usual
 * terminal font, so a square framebuffer stays square. An empty framebuffer or
 * area answers an empty rect at 0, 0.
 */
export const fitFramebuffer = (
  fbW: i32,
  fbH: i32,
  cols: i32,
  rows: i32,
  cellW: i32,
  cellH: i32,
  backend: i32
): PixelRect => {
  if (fbW <= 0 || fbH <= 0 || cols <= 0 || rows <= 0) {
    return new PixelRect(0, 0, 0, 0, 0, 0, 0.0)
  }
  const inPixels: boolean = backend === GRAPHICS_SIXEL || backend === GRAPHICS_KITTY
  const unknownCell: boolean = cellW <= 0 || cellH <= 0
  let pw: i32 = 1
  let ph: i32 = 2
  if (inPixels) {
    pw = unknownCell ? PIXELS_CELL_W : cellW
    ph = unknownCell ? PIXELS_CELL_H : cellH
  }
  // The products are f64, exact below 2^53, so that a large area cannot
  // overflow i32 while the two aspect ratios are compared.
  const availW: f64 = toF64(cols) * toF64(pw)
  const availH: f64 = toF64(rows) * toF64(ph)
  let w: i32 = 0
  let h: i32 = 0
  if (toF64(fbW) * availH >= toF64(fbH) * availW) {
    w = toI32(availW)
    h = toI32(Math.floor((toF64(fbH) * availW) / toF64(fbW)))
  } else {
    h = toI32(availH)
    w = toI32(Math.floor((toF64(fbW) * availH) / toF64(fbH)))
  }
  w = w < 1 ? 1 : w
  h = h < 1 ? 1 : h
  const usedCols: i32 = pixelsCeilDiv(w, pw)
  const usedRows: i32 = pixelsCeilDiv(h, ph)
  const scale: f64 = toF64(w) / toF64(fbW)
  const col: i32 = (cols - usedCols) >> 1
  const row: i32 = (rows - usedRows) >> 1
  if (backend === GRAPHICS_ASCII) {
    return new PixelRect(col, row, usedCols, usedRows, usedCols, usedRows, scale)
  }
  return new PixelRect(col, row, usedCols, usedRows, w, h, scale)
}

/**
 * A growable buffer of the bytes an encoder writes. `text()` is them as a
 * string, ready for one write; `reset()` empties it and keeps its capacity, so
 * one buffer serves every frame.
 */
export class PixelBytes {
  /** The bytes, of which the first `length` are written. */
  bytes: u8[]
  /** How many bytes are written. */
  length: i32

  /** An empty buffer with room for `capacity` bytes before it grows. */
  constructor(capacity: i32) {
    this.bytes = new Array<u8>(Math.max(capacity, 16))
    this.bytes.fill(0)
    this.length = 0
  }

  /** Forget what was written. */
  reset(): void {
    this.length = 0
  }

  /** Make room for `n` more bytes, doubling the array as often as that takes. */
  reserve(n: i32): void {
    const need: i32 = this.length + n
    if (need <= toI32(this.bytes.length)) {
      return
    }
    // Doubled in f64, which cannot overflow, and capped at the longest array.
    let size: f64 = toF64(this.bytes.length)
    while (size < toF64(need)) {
      size = size * 2.0
    }
    const grown: u8[] = new Array<u8>(toI32(Math.min(size, 2147483647.0)))
    grown.fill(0)
    grown.set(this.bytes, 0)
    this.bytes = grown
  }

  /** Append the byte `b`. */
  put(b: i32): void {
    this.reserve(PIXELS_ONE)
    this.bytes[this.length] = toU8(b)
    this.length = this.length + 1
  }

  /** Append `s`, which is ASCII. */
  putText(s: string): void {
    const n: i32 = toI32(s.length)
    this.reserve(n)
    for (let i: i32 = 0; i < n; i++) {
      this.bytes[this.length + i] = toU8(s.charCodeAt(i))
    }
    this.length = this.length + n
  }

  /** Append `v`, at least 0, in decimal. */
  putDecimal(v: i32): void {
    if (v >= 10) {
      this.putDecimal((v / 10) | 0)
    }
    this.put(PIXELS_DIGIT_0 + (v % 10))
  }

  /** What was written, as one string. */
  text(): string {
    return String.fromBytes(this.bytes, 0, this.length)
  }
}

/**
 * For each of `n` destination pixels along one axis, the framebuffer pixel it
 * samples: the one under the destination pixel's centre, nearest-neighbour,
 * computed once per frame rather than once per pixel.
 */
const pixelsSampleMap = (n: i32, source: i32): i32[] => {
  const map: i32[] = new Array<i32>(n)
  for (let i: i32 = 0; i < n; i++) {
    const s: i32 = toI32(Math.floor(((toF64(i) + 0.5) * toF64(source)) / toF64(n)))
    map[i] = s >= source ? source - 1 : s
  }
  return map
}

/** Append `ESC _ G`, which opens a kitty graphics command (an APC). */
const pixelsKittyOpen = (out: PixelBytes): void => {
  out.put(PIXELS_ESC)
  out.putText("_G")
}

/** Append `ESC \`, the string terminator that closes an APC or a DCS. */
const pixelsStringEnd = (out: PixelBytes): void => {
  out.put(PIXELS_ESC)
  out.put(PIXELS_BACKSLASH)
}

/**
 * Append one frame of `fb` in the kitty graphics protocol
 * (https://sw.kovidgoyal.net/kitty/graphics-protocol/), placed over `rect`.
 *
 * 1. The cursor moves to the rect's first cell, where kitty places an image.
 * 2. `a=d,d=I,i=<id>` deletes the image `imageId` and every placement of it,
 *    data included, so that sending a frame each tick does not grow the
 *    terminal's memory. The same id is reused for every frame; on the first
 *    there is nothing to delete, and `q=2` keeps the terminal from answering
 *    either way, so the encoder needs no memory of what it sent.
 * 3. `a=T` transmits and displays at once: `f=24` is packed RGB, `t=d` direct
 *    transfer (`KITTY_TRANSFER_DIRECT`), `s` and `v` the framebuffer's own
 *    size, `c` and `r` the rect's cells, which kitty scales the image to —
 *    so a downgraded framebuffer costs fewer bytes and still fills the rect —
 *    `C=1` leaves the cursor where it was, and `q=2` suppresses every reply.
 * 4. The RGB bytes go as base64 (RFC 4648 §4) in chunks of 4096 characters,
 *    the protocol's limit: each but the last carries `m=1`, the last `m=0`.
 *    Only the first chunk carries the keys; the rest carry `m` alone.
 *
 * An empty framebuffer or rect writes the delete and nothing else.
 */
export const kittyFrame = (fb: Framebuffer, rect: PixelRect, imageId: i32, out: PixelBytes): void => {
  out.putText(moveCursor(rect.col, rect.row))
  pixelsKittyOpen(out)
  out.putText("a=d,d=I,i=")
  out.putDecimal(imageId)
  out.putText(",q=2")
  pixelsStringEnd(out)
  const count: i32 = fb.width * fb.height
  if (count === 0 || rect.cols <= 0 || rect.rows <= 0) {
    return
  }
  const raw: u8[] = new Array<u8>(PIXELS_KITTY_RAW)
  const total: i32 = count * 3
  let sent: i32 = 0
  let pixel: i32 = 0
  while (sent < total) {
    // The next chunk's pixels as RGB bytes, 1024 pixels to a full chunk.
    const n: i32 = total - sent < PIXELS_KITTY_RAW ? total - sent : PIXELS_KITTY_RAW
    for (let k: i32 = 0; k < n; k = k + 3) {
      const c: i32 = fb.pixels[pixel]
      raw[k] = toU8((c >> 16) & 255)
      raw[k + 1] = toU8((c >> 8) & 255)
      raw[k + 2] = toU8(c & 255)
      pixel = pixel + 1
    }
    pixelsKittyOpen(out)
    if (sent === 0) {
      out.putText("a=T,f=24,t=d,i=")
      out.putDecimal(imageId)
      out.putText(",s=")
      out.putDecimal(fb.width)
      out.putText(",v=")
      out.putDecimal(fb.height)
      out.putText(",c=")
      out.putDecimal(rect.cols)
      out.putText(",r=")
      out.putDecimal(rect.rows)
      out.putText(",C=1,q=2,")
    }
    sent = sent + n
    out.putText(sent < total ? "m=1;" : "m=0;")
    out.reserve(PIXELS_KITTY_CHUNK)
    out.length = base64EncodeInto(raw, 0, n, out.bytes, out.length)
    pixelsStringEnd(out)
  }
}

/** The Sixel register of the palette colour with red level `r` (0–5), green `g` (0–6) and blue `b` (0–5). */
const pixelsSixelRegister = (r: i32, g: i32, b: i32): i32 => r * 42 + g * 6 + b

/**
 * The level of one 0–255 component among `levels`, nearest, after `bias` (a
 * dither offset, 0 without dithering) is added and the sum clamped to 0–255.
 */
const pixelsLevel = (v: i32, bias: i32, levels: i32): i32 => {
  const x: i32 = Math.min(Math.max(v + bias, 0), 255)
  return ((x * (levels - 1) * 2 + 255) / 510) | 0
}

/**
 * The dither offset for one component quantised to `levels`, at Bayer
 * threshold `t` (0–15): spread evenly over one quantisation step, centred on
 * zero, so a flat colour between two levels becomes a fixed pattern of both.
 */
const pixelsDitherBias = (t: i32, levels: i32): i32 => (((t * 2 - 15) * 255) / ((levels - 1) * 32)) | 0

/** Append the sixel character for the six-pixel column `bits`, `count` times, run-length encoded. */
const pixelsSixelRun = (out: PixelBytes, bits: i32, count: i32): void => {
  // `!n` followed by the character repeats it n times (DECGRI); three or fewer
  // are as short written out.
  if (count > 3) {
    out.put(SIXEL_REPEAT)
    out.putDecimal(count)
    out.put(SIXEL_BLANK + bits)
  } else {
    for (let k: i32 = 0; k < count; k++) {
      out.put(SIXEL_BLANK + bits)
    }
  }
}

/**
 * Append one frame of `fb` as DEC Sixel graphics, drawn over `rect`'s
 * `width × height` terminal pixels from its first cell. The format is DEC's
 * (VT330/VT340 Programmer Reference, "Sixel Graphics"; DECSIXEL):
 *
 * - `ESC P q` opens the device control string with the default parameters, and
 *   `ESC \` closes it.
 * - `"1;1;w;h` is the raster attributes (DECGRA): square pixels and the
 *   image's size, so the terminal can reserve it before the data arrives.
 * - `#n;2;r;g;b` sets colour register `n` to an RGB colour in percent
 *   (DECGCI). The palette is fixed: 6 levels of red, 7 of green and 6 of blue,
 *   252 registers (`SIXEL_REGISTERS`), the most that fits the 256 a
 *   terminal must offer. A register always holds the same colour, so frames
 *   never fight over the palette and nothing flickers; each frame declares the
 *   registers it uses, in ascending order.
 * - The image goes in bands six pixels tall. Within a band, `#n` selects a
 *   register and each character `?`–`~` is a column of six pixels, one bit
 *   each, painted in it; `!n` repeats a character, `$` returns to the band's
 *   start for the next colour, and `-` moves to the next band.
 *
 * With `dither`, each pixel's components are offset by the 4×4 Bayer
 * matrix's threshold before they are quantised (ordered dithering), so a
 * gradient becomes a fine, stable pattern rather than steps. An empty rect
 * writes nothing.
 */
export const sixelFrame = (fb: Framebuffer, rect: PixelRect, dither: boolean, out: PixelBytes): void => {
  const w: i32 = rect.width
  const h: i32 = rect.height
  if (w <= 0 || h <= 0 || fb.width <= 0 || fb.height <= 0) {
    return
  }
  pixelsCheckSize("sixelFrame", w, h)
  pixelsCheckSize("sixelFrame", w, SIXEL_REGISTERS)
  const xs: i32[] = pixelsSampleMap(w, fb.width)
  const ys: i32[] = pixelsSampleMap(h, fb.height)
  // Every destination pixel's register, and which registers the frame uses.
  const reg: i32[] = new Array<i32>(w * h)
  const used: u8[] = new Array<u8>(SIXEL_REGISTERS)
  used.fill(0)
  for (let y: i32 = 0; y < h; y++) {
    const from: i32 = ys[y] * fb.width
    for (let x: i32 = 0; x < w; x++) {
      const c: i32 = fb.pixels[from + xs[x]]
      let br: i32 = 0
      let bg: i32 = 0
      let bb: i32 = 0
      if (dither) {
        const t: i32 = pixelsHex(PIXELS_BAYER, ((y & 3) << 2) | (x & 3), 1)
        br = pixelsDitherBias(t, 6)
        bg = pixelsDitherBias(t, 7)
        bb = pixelsDitherBias(t, 6)
      }
      const n: i32 = pixelsSixelRegister(
        pixelsLevel((c >> 16) & 255, br, 6),
        pixelsLevel((c >> 8) & 255, bg, 7),
        pixelsLevel(c & 255, bb, 6)
      )
      reg[y * w + x] = n
      used[n] = 1
    }
  }
  out.putText(moveCursor(rect.col, rect.row))
  out.put(PIXELS_ESC)
  out.putText('Pq"1;1;')
  out.putDecimal(w)
  out.put(PIXELS_SEMICOLON)
  out.putDecimal(h)
  for (let n: i32 = 0; n < SIXEL_REGISTERS; n++) {
    if (used[n] !== 0) {
      const r: i32 = (n / 42) | 0
      const g: i32 = ((n / 6) | 0) % 7
      const b: i32 = n % 6
      out.put(SIXEL_COLOUR)
      out.putDecimal(n)
      out.putText(";2;")
      out.putDecimal(((r * 100) / 5) | 0)
      out.put(PIXELS_SEMICOLON)
      out.putDecimal(((g * 100) / 6) | 0)
      out.put(PIXELS_SEMICOLON)
      out.putDecimal(((b * 100) / 5) | 0)
    }
  }
  // Per band: the first and last column each register appears in, so a colour
  // is only walked over the span it covers, and each register's sixels across
  // the band, `n * w + x`, built in one pass over its pixels. Emitting a span
  // zeroes it, which leaves `bits` all zero for the next band.
  const first: i32[] = new Array<i32>(SIXEL_REGISTERS)
  const last: i32[] = new Array<i32>(SIXEL_REGISTERS)
  const bits: i32[] = new Array<i32>(SIXEL_REGISTERS * w)
  bits.fill(0)
  for (let top: i32 = 0; top < h; top = top + 6) {
    const bottom: i32 = top + 6 < h ? top + 6 : h
    first.fill(-1)
    for (let y: i32 = top; y < bottom; y++) {
      const bit: i32 = PIXELS_ONE << (y - top)
      for (let x: i32 = 0; x < w; x++) {
        const n: i32 = reg[y * w + x]
        bits[n * w + x] = bits[n * w + x] | bit
        if (first[n] < 0) {
          first[n] = x
          last[n] = x
        } else if (x < first[n]) {
          first[n] = x
        } else if (x > last[n]) {
          last[n] = x
        }
      }
    }
    if (top > 0) {
      out.put(SIXEL_NEXT_LINE)
    }
    let firstColour: boolean = true
    for (let n: i32 = 0; n < SIXEL_REGISTERS; n++) {
      if (first[n] < 0) {
        continue
      }
      if (!firstColour) {
        out.put(SIXEL_RETURN)
      }
      firstColour = false
      out.put(SIXEL_COLOUR)
      out.putDecimal(n)
      // Blank columns before the colour's first one, then its runs to its last.
      pixelsSixelRun(out, 0, first[n])
      let runBits: i32 = -1
      let runCount: i32 = 0
      const row: i32 = n * w
      for (let x: i32 = first[n]; x <= last[n]; x++) {
        const sixel: i32 = bits[row + x]
        bits[row + x] = 0
        if (sixel === runBits) {
          runCount = runCount + 1
        } else {
          if (runCount > 0) {
            pixelsSixelRun(out, runBits, runCount)
          }
          runBits = sixel
          runCount = 1
        }
      }
      pixelsSixelRun(out, runBits, runCount)
    }
  }
  pixelsStringEnd(out)
}

/**
 * Draw `fb` onto `canvas`'s pixels over `rect` (from `fitFramebuffer` with
 * `GRAPHICS_HALFBLOCK`): two pixels a cell, the upper and lower half block.
 * The image's own pixels are set; a rect row's lower half that the image does
 * not reach is set to `COLOR_DEFAULT`. Each covered cell is repainted once,
 * and `Screen.flush` sends only the cells whose glyph or colours changed, so
 * a frame that barely moves costs almost nothing.
 */
export const drawHalfBlocks = (fb: Framebuffer, canvas: Canvas, rect: PixelRect): void => {
  if (rect.width <= 0 || rect.height <= 0 || fb.width <= 0 || fb.height <= 0) {
    return
  }
  const xs: i32[] = pixelsSampleMap(rect.width, fb.width)
  const ys: i32[] = pixelsSampleMap(rect.height, fb.height)
  const left: i32 = rect.col
  const top: i32 = rect.row * 2
  for (let y: i32 = 0; y < rect.rows * 2; y++) {
    const py: i32 = top + y
    if (py < 0 || py >= canvas.height) {
      continue
    }
    for (let x: i32 = 0; x < rect.width; x++) {
      const px: i32 = left + x
      if (px < 0 || px >= canvas.width) {
        continue
      }
      canvas.pixels[py * canvas.width + px] =
        y < rect.height ? fb.pixels[ys[y] * fb.width + xs[x]] : COLOR_DEFAULT
    }
  }
  for (let row: i32 = rect.row; row < rect.row + rect.rows; row++) {
    for (let col: i32 = left; col < left + rect.width; col++) {
      if (row >= 0 && col >= 0 && row * 2 < canvas.height && col < canvas.width) {
        canvas.paintCell(col, row)
      }
    }
  }
}

/** The one of xterm's 16 standard colours nearest `colour` in RGB; a tie goes to the lower number. */
const pixelsNearestAnsi16 = (colour: i32): i32 => {
  const r: i32 = (colour >> 16) & 255
  const g: i32 = (colour >> 8) & 255
  const b: i32 = colour & 255
  let best: i32 = 0
  let bestDistance: i32 = 2147483647
  for (let i: i32 = 0; i < 16; i++) {
    const c: i32 = pixelsHex(PIXELS_ANSI16, i * 6, 6)
    const dr: i32 = r - ((c >> 16) & 255)
    const dg: i32 = g - ((c >> 8) & 255)
    const db: i32 = b - (c & 255)
    const d: i32 = dr * dr + dg * dg + db * db
    if (d < bestDistance) {
      best = c
      bestDistance = d
    }
  }
  return best
}

/**
 * Draw `fb` onto `screen`'s cells over `rect` (from `fitFramebuffer` with
 * `GRAPHICS_ASCII`), one character a cell for terminals with no graphics: the
 * framebuffer pixel under the cell's centre picks a character from the ramp
 * ` .:-=+*#%@` by its luminance (Rec. 601 weights, darkest first) and is the
 * character's colour, on the terminal's own background.
 *
 * When `colors` is 16 — the Linux console — the colour is first moved to the
 * nearest of xterm's 16 standard colours. `Screen` sends colours as 24-bit or
 * 256-palette SGR only, and a console that reduces those to its 16 itself then
 * lands on the colour chosen here, not on a neighbour of it.
 */
export const drawAscii = (fb: Framebuffer, screen: Screen, rect: PixelRect, colors: i32): void => {
  if (rect.width <= 0 || rect.height <= 0 || fb.width <= 0 || fb.height <= 0) {
    return
  }
  const xs: i32[] = pixelsSampleMap(rect.width, fb.width)
  const ys: i32[] = pixelsSampleMap(rect.height, fb.height)
  const ramp: i32 = toI32(PIXELS_RAMP.length)
  for (let y: i32 = 0; y < rect.height; y++) {
    const from: i32 = ys[y] * fb.width
    for (let x: i32 = 0; x < rect.width; x++) {
      const c: i32 = fb.pixels[from + xs[x]]
      const luma: i32 = ((((c >> 16) & 255) * 299 + ((c >> 8) & 255) * 587 + (c & 255) * 114) / 1000) | 0
      const glyph: i32 = toI32(PIXELS_RAMP.charCodeAt(((luma * ramp) / 256) | 0))
      const fg: i32 = colors === 16 ? pixelsNearestAnsi16(c) : c
      screen.set(rect.col + x, rect.row + y, glyph, fg, COLOR_DEFAULT, ATTR_NONE)
    }
  }
}
