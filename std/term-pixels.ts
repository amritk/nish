/**
 * `nish/term-pixels` — a framebuffer of pixels, and the encoders that draw it
 * to a terminal with the best backend the terminal has: kitty graphics, Sixel,
 * half-block cells or ASCII.
 *
 * A program draws `0xRRGGBB` pixels into a `Framebuffer` and never thinks about
 * the terminal; `nish/term-io` picks the backend and calls one encoder per frame.
 * Everything here is pure: no capability, no I/O, and the bytes are the same
 * natively and under Node, because the kitty and Sixel output is ASCII and the
 * cell drawers go through `Screen`, which already is.
 *
 *     import { fitFramebuffer, GRAPHICS_KITTY, kittyFrame, PixelBytes, tryFramebuffer } from "nish/term-pixels"
 *
 *     const fb = tryFramebuffer(160, 90).expect("a 160 × 90 framebuffer")
 *     fb.fill(0x000020)
 *     fb.set(80, 45, 0xffcc00)
 *     const rect = fitFramebuffer(fb.pixelWidth(), fb.pixelHeight(), 80, 24, 0, 0, GRAPHICS_KITTY)
 *     const out = new PixelBytes(1 << 16)
 *     kittyFrame(fb, rect, 1, out)
 *     // out.text() is the frame's bytes, for one write
 *
 * - `Framebuffer(width, height)` holds the pixels, with `set`, `get`, `fill`,
 *   `clear` and `resize`, and `pixelWidth`, `pixelHeight` and `pixelData` to
 *   read its size and array. `tryFramebuffer(width, height)` and `tryResize`
 *   answer an `Err` for a size the constructor and `resize` panic on.
 *   `scaleFramebuffer(src, divisor, dst)` shrinks one by an integer divisor,
 *   nearest-neighbour, for the refresh controller's resolution downgrade.
 * - `GRAPHICS_ASCII`, `GRAPHICS_HALFBLOCK`, `GRAPHICS_SIXEL` and
 *   `GRAPHICS_KITTY` name the backends, numbered from worst to best so that a
 *   capability and a cap combine with `Math.min`.
 * - `fitFramebuffer(fbW, fbH, cols, rows, cellW, cellH, backend)` answers the
 *   `PixelRect` the image is drawn in: the cells it covers, centred in a
 *   `cols × rows` area (letterboxed), and its size in the backend's pixels,
 *   keeping the framebuffer's aspect ratio.
 * - `kittyFrame(fb, rect, imageId, out)` writes the kitty graphics commands for
 *   one frame into a `PixelBytes`; `KITTY_TRANSFER_DIRECT` is its transfer.
 *   Every frame retransmits the same `imageId`, which the terminal swaps in
 *   atomically, so there is no per-frame delete; `kittyDelete(imageId)` is the
 *   command that frees the image when the program closes.
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
 * `PixelBytes` holds the kitty and Sixel encoders' working arrays as well as
 * their output, grown once to the largest frame, so a program that keeps one
 * `PixelBytes` encodes frame after frame without allocating.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 */
import { base64EncodeIfFits } from "nish/base64"
import { COLOR_DEFAULT, ATTR_NONE, Canvas, Screen } from "nish/term"

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

/** `[`, which follows ESC to open a control sequence (ECMA-48 CSI). */
const PIXELS_BRACKET: i32 = 91

/** `H`, the final byte of cursor position (ECMA-48 CUP). */
const PIXELS_CUP: i32 = 72

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
  const length: i32 = toI32(text.length)
  const end: i64 = toI64(at) + toI64(count)
  for (let i: i32 = at; toI64(i) < end && i >= 0 && i < length; i++) {
    const c: i32 = toI32(text.charCodeAt(i))
    v = (v << 4) | (c >= 97 ? c - 87 : c - 48)
  }
  return v
}

/** `width × height`, after panicking, as `who`, unless it is a size an array of pixels can have. */
const pixelsArea = (who: string, width: i32, height: i32): i32 => {
  if (width < 0 || height < 0) {
    panic(`${who}: a negative size`)
  }
  const area: i64 = toI64(width) * toI64(height)
  if (area > toI64(2147483647)) {
    panic(`${who}: more than 2^31 - 1 pixels`)
  }
  return toI32(area)
}

/** Why `width × height`, asked of `who`, is not a size an array of pixels can have, or "" when it is. */
const pixelsSizeProblem = (who: string, width: i32, height: i32): string => {
  if (width < 0 || height < 0) {
    return `${who}: a negative size, ${width} × ${height}`
  }
  if (toI64(width) * toI64(height) > toI64(2147483647)) {
    return `${who}: ${width} × ${height} is more than 2^31 - 1 pixels`
  }
  return ""
}

/** `y * width + x` as an index below `length`, or -1 when it is not one. */
const pixelsIndex = (x: i32, y: i32, width: i32, length: i32): i32 => {
  const wide: i64 = toI64(y) * toI64(width) + toI64(x)
  return wide < toI64(0) || wide >= toI64(length) ? -1 : toI32(wide)
}

/** A `width × height` grid of `0xRRGGBB` pixels, row by row, all black when made. */
export class Framebuffer {
  /** Pixels across. */
  width: i32
  /** Pixels down. */
  height: i32
  /** One colour per pixel, `y * width + x`. */
  pixels: i32[]

  /**
   * A black framebuffer of `width × height`; a negative size, or more than 2^31 - 1 pixels, panics.
   *
   * @param width Pixels across.
   * @param height Pixels down.
   */
  constructor(width: i32, height: i32) {
    const area: i32 = pixelsArea("Framebuffer", width, height)
    this.width = width
    this.height = height
    this.pixels = new Array<i32>(area)
    this.pixels.fill(0)
  }

  /**
   * Make the framebuffer `width × height` and black; the array is replaced only when the size changes.
   *
   * @param width The new pixels across; negative panics, as in the constructor.
   * @param height The new pixels down; negative panics, as in the constructor.
   */
  resize(width: i32, height: i32): void {
    const area: i32 = pixelsArea("Framebuffer.resize", width, height)
    if (width !== this.width || height !== this.height) {
      this.width = width
      this.height = height
      this.pixels = new Array<i32>(area)
    }
    this.pixels.fill(0)
  }

  /**
   * Pixels across, as the `width` field holds it.
   *
   * @returns The width, 0 or more.
   */
  pixelWidth(): i32 {
    return this.width
  }

  /**
   * Pixels down, as the `height` field holds it.
   *
   * @returns The height, 0 or more.
   */
  pixelHeight(): i32 {
    return this.height
  }

  /**
   * The pixels, one `0xRRGGBB` colour each at `y * pixelWidth() + x`, for `rasterFrame` to draw
   * into, as the `pixels` field holds them.
   *
   * @returns The framebuffer's own array, not a copy.
   */
  pixelData(): i32[] {
    return this.pixels
  }

  /**
   * `resize` for a caller with an answer to a size it cannot have: make the framebuffer
   * `width × height` and black, replacing the array only when the size changes, or leave it as
   * it was and answer `Err`.
   *
   * @param width The new pixels across, 0 or more.
   * @param height The new pixels down, 0 or more.
   * @returns `Ok`, or `Err` naming the problem for a negative size or more than 2^31 - 1 pixels.
   */
  tryResize(width: i32, height: i32): Result<void, string> {
    const area: i64 = toI64(width) * toI64(height)
    // `area < 0` follows from a negative side; it is written out because it is
    // what proves `length` below in range.
    if (width < 0 || height < 0 || area < toI64(0) || area > toI64(2147483647)) {
      return Err(pixelsSizeProblem("Framebuffer.tryResize", width, height))
    }
    const count: i32 = toI32(area)
    // Never taken: the check above keeps `area` in range. It is written out
    // because it is what proves `length` below.
    if (count < 0) {
      return Err(pixelsSizeProblem("Framebuffer.tryResize", width, height))
    }
    if (width !== this.width || height !== this.height) {
      const length: integer<0, 2147483647> = count
      this.width = width
      this.height = height
      this.pixels = new Array<i32>(length)
    }
    this.pixels.fill(0)
    return Ok()
  }

  /**
   * Set the pixel at `x`, `y` to `colour`'s low 24 bits; a pixel off the framebuffer is not drawn.
   * Panics when `pixels` does not hold `width × height`, as after setting those public fields
   * out of step.
   *
   * @param x The pixel column, from 0 at the left.
   * @param y The pixel row, from 0 at the top.
   * @param colour An `0xRRGGBB` colour; the bits above it are dropped.
   */
  set(x: i32, y: i32, colour: i32): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return
    }
    const pixels: i32[] = this.pixels
    const at: i32 = pixelsIndex(x, y, this.width, toI32(pixels.length))
    // In range while `pixels` holds `width * height`. The fields are public,
    // and one set out of step with the others is a broken framebuffer, which
    // panics as indexing past `pixels` did, rather than drop the write.
    if (at < 0 || at >= toI32(pixels.length)) {
      panic("Framebuffer.set: pixels does not hold width × height")
    }
    pixels[at] = colour & 0xffffff
  }

  /**
   * The colour of the pixel at `x`, `y`, or black off the framebuffer. Panics when `pixels` does
   * not hold `width × height`, as after setting those public fields out of step.
   *
   * @param x The pixel column, from 0 at the left.
   * @param y The pixel row, from 0 at the top.
   * @returns The colour as `0xRRGGBB`; 0, black, off the framebuffer.
   */
  get(x: i32, y: i32): i32 {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return 0
    }
    const pixels: i32[] = this.pixels
    const at: i32 = pixelsIndex(x, y, this.width, toI32(pixels.length))
    // In range while `pixels` holds `width * height`. The fields are public,
    // and one set out of step with the others is a broken framebuffer, which
    // panics as indexing past `pixels` did, rather than read as black.
    if (at < 0 || at >= toI32(pixels.length)) {
      panic("Framebuffer.get: pixels does not hold width × height")
    }
    return pixels[at]
  }

  /**
   * Set every pixel to `colour`'s low 24 bits.
   *
   * @param colour An `0xRRGGBB` colour; the bits above it are dropped.
   */
  fill(colour: i32): void {
    this.pixels.fill(colour & 0xffffff)
  }

  /** Set every pixel to black. */
  clear(): void {
    this.pixels.fill(0)
  }
}

/**
 * The `Framebuffer` constructor for a caller with an answer to a size it cannot have: a black
 * framebuffer of `width × height`, or `Err`. It builds an empty framebuffer and sizes it with
 * `tryResize`, so a call still reaches the size checks of the constructor, which panic only on a
 * size an empty one never has; `--deny-panics` reports them at the call.
 *
 * @param width Pixels across, 0 or more.
 * @param height Pixels down, 0 or more.
 * @returns The framebuffer, or `Err` naming the problem for a negative size or more than
 * 2^31 - 1 pixels.
 */
export const tryFramebuffer = (width: i32, height: i32): Result<Framebuffer, string> => {
  const fb: Framebuffer = new Framebuffer(0, 0)
  const sized: Result<void, string> = fb.tryResize(width, height)
  if (sized.isErr()) {
    return Err(pixelsSizeProblem("tryFramebuffer", width, height))
  }
  return Ok(fb)
}

/**
 * Shrink `src` by `divisor` into `dst`, which is resized to
 * `ceil(width / divisor) × ceil(height / divisor)`: each pixel of `dst` is the
 * top-left pixel of its `divisor × divisor` block, nearest-neighbour, so a
 * frame costs a quarter or a sixteenth of the bytes at divisor 2 or 4. A
 * divisor below 1 panics; 1 copies. `dst` must be another framebuffer than
 * `src`, which resizing it would blank.
 *
 * @param src The full-size framebuffer, read only.
 * @param divisor How many pixels across and down become one, 1 or more; 2 or 4 for the controller's steps.
 * @param dst Where the shrunk frame goes; resized to fit.
 */
export const scaleFramebuffer = (src: Framebuffer, divisor: i32, dst: Framebuffer): void => {
  if (divisor < 1) {
    panic("scaleFramebuffer: a divisor below 1")
  }
  const w: i32 = pixelsCeilDiv(src.width, divisor)
  const h: i32 = pixelsCeilDiv(src.height, divisor)
  dst.resize(w, h)
  const from: i32[] = src.pixels
  const to: i32[] = dst.pixels
  const srcW: i32 = src.width
  // `x * divisor` and `y * divisor` stay below the source's size, as `w` and
  // `h` are its size over `divisor` rounded up; the loops say so for the
  // prover. Each index is then in its array while each framebuffer's `pixels`
  // holds its `width * height`; one whose public fields a caller set out of
  // step panics, as indexing past `pixels` did, rather than skip the pixel.
  for (let y: i32 = 0; y < h && toI64(y) * toI64(divisor) < toI64(src.height); y++) {
    const sy: i32 = toI32(toI64(y) * toI64(divisor))
    for (let x: i32 = 0; x < w && toI64(x) * toI64(divisor) < toI64(srcW); x++) {
      const s: i32 = pixelsIndex(toI32(toI64(x) * toI64(divisor)), sy, srcW, toI32(from.length))
      const d: i32 = pixelsIndex(x, y, w, toI32(to.length))
      if (s < 0 || s >= toI32(from.length) || d < 0 || d >= toI32(to.length)) {
        panic("scaleFramebuffer: pixels does not hold width × height")
      }
      to[d] = from[s]
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

  /**
   * A rect of the given cells and size; `fitFramebuffer` is how one is usually made.
   *
   * @param col The first column covered, from 0.
   * @param row The first row covered, from 0.
   * @param cols The columns covered.
   * @param rows The rows covered.
   * @param width The image's width in the backend's pixels.
   * @param height The image's height in the backend's pixels.
   * @param scale The backend's pixels per framebuffer pixel across.
   */
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
const pixelsCeilDiv = (a: i32, b: i32): i32 => {
  if (a <= 0 || b <= 0) {
    return 0
  }
  // `q` is at most `a - 1`, so `q + 1` cannot overflow; the test says so.
  const q: i32 = ((a - 1) / b) | 0
  return q < a ? q + 1 : a
}

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
 *
 * @param fbW The framebuffer's width in pixels.
 * @param fbH The framebuffer's height in pixels.
 * @param cols The area's width in cells.
 * @param rows The area's height in cells.
 * @param cellW A cell's width in pixels as the terminal reported it, or 0 or less when it did not say.
 * @param cellH A cell's height in pixels likewise; with either at 0 or less, kitty and Sixel take the cell as 8×16.
 * @param backend The `GRAPHICS_` backend that will draw it, which decides what a pixel of the rect is.
 * @returns Where to draw, in the area's cells and the backend's pixels.
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
  const col: i32 = toI32(Math.floor((toF64(cols) - toF64(usedCols)) / 2.0))
  const row: i32 = toI32(Math.floor((toF64(rows) - toF64(usedRows)) / 2.0))
  if (backend === GRAPHICS_ASCII) {
    return new PixelRect(col, row, usedCols, usedRows, usedCols, usedRows, scale)
  }
  return new PixelRect(col, row, usedCols, usedRows, w, h, scale)
}

/**
 * A growable buffer of the bytes an encoder writes. `text()` is them as a
 * string, ready for one write; `reset()` empties it and keeps its capacity, so
 * one buffer serves every frame.
 *
 * It also holds the working arrays of `kittyFrame` and `sixelFrame`, grown to
 * the largest frame and then reused, so that encoding a frame allocates
 * nothing once the buffer has seen one as large: a frame loop calling an
 * encoder 60 times a second runs in flat memory. An encoder's arrays could
 * not be its own locals, because the arena cannot take a call's allocations
 * back while that call grows a buffer it was handed (`bytes` above).
 */
export class PixelBytes {
  /** The bytes, of which the first `length` are written. */
  bytes: u8[]
  /** How many bytes are written. */
  length: i32
  /**
   * True once a frame asked for more than one buffer holds: a `put` past
   * 2^31 - 1 bytes, which was dropped, or a `sixelFrame` rect whose working
   * arrays would pass 2^31 - 1 entries. `text()` is then not the whole escape
   * and is not to be written. `reset()` clears it.
   */
  full: boolean
  /**
   * One kitty chunk's RGB bytes.
   * @internal Used by `kittyFrame`.
   */
  kittyRaw: u8[]
  /**
   * The framebuffer column and row each destination pixel samples.
   * @internal Used by `sixelFrame`.
   */
  sampleXs: i32[]
  /** @internal Used by `sixelFrame`. */
  sampleYs: i32[]
  /**
   * Every destination pixel's Sixel register, row by row.
   * @internal Used by `sixelFrame`.
   */
  sixelReg: i32[]
  /**
   * Which registers a Sixel frame uses, 1 or 0.
   * @internal Used by `sixelFrame`.
   */
  sixelUsed: u8[]
  /**
   * The first and last column of a band each register covers, -1 for none.
   * @internal Used by `sixelFrame`.
   */
  sixelFirst: i32[]
  /** @internal Used by `sixelFrame`. */
  sixelLast: i32[]
  /**
   * Each register's sixels across a band, all zero between bands.
   * @internal Used by `sixelFrame`.
   */
  sixelBits: i32[]

  /**
   * An empty buffer with room for `capacity` bytes before it grows.
   *
   * @param capacity The bytes to make room for at the start; a frame's worth saves growing.
   */
  constructor(capacity: i32) {
    this.bytes = capacity > 16 ? new Array<u8>(capacity) : new Array<u8>(16)
    this.bytes.fill(0)
    this.length = 0
    this.full = false
    this.kittyRaw = new Array<u8>(PIXELS_KITTY_RAW)
    this.kittyRaw.fill(0)
    this.sampleXs = []
    this.sampleYs = []
    this.sixelReg = []
    this.sixelUsed = new Array<u8>(SIXEL_REGISTERS)
    this.sixelUsed.fill(0)
    this.sixelFirst = new Array<i32>(SIXEL_REGISTERS)
    this.sixelFirst.fill(-1)
    this.sixelLast = new Array<i32>(SIXEL_REGISTERS)
    this.sixelLast.fill(-1)
    this.sixelBits = []
  }

  /** Forget what was written. */
  reset(): void {
    this.length = 0
    this.full = false
  }

  /**
   * Make room for `n` more bytes, doubling the array as often as that takes.
   * Room past 2^31 - 1 bytes is not made: the buffer is marked `full` instead.
   *
   * @param n How many bytes the caller is about to `put`.
   */
  reserve(n: i32): void {
    const had: u8[] = this.bytes
    const have: i32 = toI32(had.length)
    // Summed and doubled in f64, which cannot overflow.
    const need: f64 = toF64(this.length) + toF64(n)
    if (need <= toF64(have)) {
      return
    }
    let size: f64 = toF64(have)
    while (size < need) {
      size = size * 2.0
    }
    const room: i32 = need <= 2147483647.0 ? toI32(Math.min(size, 2147483647.0)) : -1
    if (room < 0 || room < have) {
      this.full = true
      return
    }
    const length: integer<0, 2147483647> = room
    const grown: u8[] = new Array<u8>(length)
    grown.fill(0)
    for (let i: i32 = 0; i < toI32(had.length) && i < toI32(grown.length); i++) {
      grown[i] = had[i]
    }
    this.bytes = grown
  }

  /**
   * Append the byte `b`.
   *
   * @param b A byte value, 0–255; only the low 8 bits are kept.
   */
  put(b: i32): void {
    this.reserve(PIXELS_ONE)
    const bytes: u8[] = this.bytes
    const at: i32 = this.length
    // Always true after `reserve`; it proves the store and the count in range.
    if (at >= 0 && at < toI32(bytes.length)) {
      bytes[at] = toU8(b)
      this.length = at + 1
    }
  }

  /**
   * Append `s`, which is ASCII.
   *
   * @param s Text of ASCII characters only, such as a command's keys.
   */
  putText(s: string): void {
    const n: i32 = toI32(s.length)
    this.reserve(n)
    const bytes: u8[] = this.bytes
    let at: i32 = this.length
    // `at` stays in range after `reserve`; bounding the loop by it proves so.
    for (let i: i32 = 0; i < n && at >= 0 && at < toI32(bytes.length); i++) {
      bytes[at] = toU8(s.charCodeAt(i))
      at = at + 1
    }
    this.length = at
  }

  /**
   * Append `v`, at least 0, in decimal.
   *
   * @param v A count or size, 0 or more.
   */
  putDecimal(v: i32): void {
    if (v >= 10) {
      this.putDecimal((v / 10) | 0)
    }
    this.put(PIXELS_DIGIT_0 + (v % 10))
  }

  /**
   * What was written, as one string.
   *
   * @returns The bytes appended since it was made or last `reset`, to `write`.
   */
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
  if (n <= 0) {
    return []
  }
  const length: integer<0, 2147483647> = n
  const map: i32[] = new Array<i32>(length)
  pixelsSampleMapInto(map, n, source)
  return map
}

/** `pixelsSampleMap` written into the first `n` entries of `map`, which is at least `n` long. */
const pixelsSampleMapInto = (map: i32[], n: i32, source: i32): void => {
  for (let i: i32 = 0; i < n && i < toI32(map.length); i++) {
    map[i] = toI32(Math.min(Math.floor(((toF64(i) + 0.5) * toF64(source)) / toF64(n)), toF64(source) - 1.0))
  }
}

/**
 * `a` when it is at least `n` long, else a new zeroed array for a `PixelBytes`
 * working array: twice `a`'s length, or `n` if that is more, so frames that
 * grow a little at a time reallocate a logarithmic number of times.
 */
const pixelsAtLeast = (a: i32[], n: i32): i32[] => {
  const had: i32 = toI32(a.length)
  if (had >= n) {
    return a
  }
  const twice: f64 = Math.min(toF64(had) * 2.0, 2147483647.0)
  const size: i32 = twice > toF64(n) ? toI32(twice) : n
  // Never taken: `n` is past `had`, which is 0 or more; it proves the length.
  if (size < 0) {
    return a
  }
  const length: integer<0, 2147483647> = size
  const grown: i32[] = new Array<i32>(length)
  grown.fill(0)
  return grown
}

/** Append `v + 1` in decimal: the 1-based number escapes give the 0-based `v`. */
const pixelsPutOneBased = (out: PixelBytes, v: i32): void => {
  if (v < 2147483647) {
    out.putDecimal(v + 1)
  } else {
    out.putText("2147483648")
  }
}

/** Append `CSI row ; col H`, the cursor to the 0-based cell (`col`, `row`), as `moveCursor` writes it. */
const pixelsMoveTo = (out: PixelBytes, col: i32, row: i32): void => {
  out.put(PIXELS_ESC)
  out.put(PIXELS_BRACKET)
  pixelsPutOneBased(out, row)
  out.put(PIXELS_SEMICOLON)
  pixelsPutOneBased(out, col)
  out.put(PIXELS_CUP)
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
 * 2. `a=T` transmits and displays at once: `f=24` is packed RGB, `t=d` direct
 *    transfer (`KITTY_TRANSFER_DIRECT`), `i` the image and `p=1` its one
 *    placement, `s` and `v` the framebuffer's own size, `c` and `r` the rect's
 *    cells, which kitty scales the image to — so a downgraded framebuffer
 *    costs fewer bytes and still fills the rect — `C=1` leaves the cursor
 *    where it was, and `q=2` suppresses every reply.
 * 3. The RGB bytes go as base64 (RFC 4648 §4) in chunks of 4096 characters,
 *    the protocol's limit: each but the last carries `m=1`, the last `m=0`.
 *    Only the first chunk carries the keys; the rest carry `q=2` and `m`,
 *    since a terminal may answer a chunk that does not repeat `q`.
 *
 * Every frame reuses `imageId` and nothing is deleted first. Transmitting an
 * id that exists replaces that image and frees the old one's data, and the
 * same image and placement id replace the placement, so the terminal holds
 * one frame however many are sent. The new frame takes over only when its
 * last chunk (`m=0`) has arrived, so the old one stays on screen while a
 * frame of hundreds of chunks streams in. Deleting first would blank the
 * image for that whole time. `kittyDelete` removes the image when the program
 * is done with it.
 *
 * `imageId` is 1 to 2^31 - 1, since 0 is the protocol's "no id"; anything
 * else panics. So does a framebuffer whose `pixels` does not hold
 * `width × height`. An empty framebuffer or rect writes nothing.
 *
 * @param fb The frame's pixels, at its own size.
 * @param rect Where to draw it, from `fitFramebuffer` with `GRAPHICS_KITTY`.
 * @param imageId The image's id, 1 or more (below 1 panics), the same for every frame of one program.
 * @param out Where the command bytes are appended.
 */
export const kittyFrame = (fb: Framebuffer, rect: PixelRect, imageId: i32, out: PixelBytes): void => {
  pixelsCheckImageId("kittyFrame", imageId)
  const pixels: i32[] = fb.pixels
  const count: i32 = toI32(pixels.length)
  // The header gives `width` and `height`; pixels of another count are a
  // framebuffer whose public fields a caller set out of step, not an image.
  if (toI64(count) !== toI64(fb.width) * toI64(fb.height)) {
    panic("kittyFrame: pixels does not hold width × height")
  }
  const raw: u8[] = out.kittyRaw
  // A `kittyRaw` cut below one pixel's 3 bytes holds none: nothing is drawn,
  // and the cursor is not moved for it.
  if (count === 0 || rect.cols <= 0 || rect.rows <= 0 || toI32(raw.length) < 3) {
    return
  }
  pixelsMoveTo(out, rect.col, rect.row)
  let pixel: i32 = 0
  while (pixel < count) {
    const first: boolean = pixel === 0
    // The next chunk's pixels as RGB bytes, `raw` (1024 pixels) to a full chunk.
    let n: i32 = 0
    while (n < toI32(raw.length) - 2 && pixel >= 0 && pixel < toI32(pixels.length)) {
      const c: i32 = pixels[pixel]
      raw[n] = toU8((c >> 16) & 255)
      raw[n + 1] = toU8((c >> 8) & 255)
      raw[n + 2] = toU8(c & 255)
      n = n + 3
      pixel = pixel + 1
    }
    pixelsKittyOpen(out)
    if (first) {
      out.putText("a=T,f=24,t=d,i=")
      out.putDecimal(imageId)
      out.putText(",p=1,s=")
      out.putDecimal(fb.width)
      out.putText(",v=")
      out.putDecimal(fb.height)
      out.putText(",c=")
      out.putDecimal(rect.cols)
      out.putText(",r=")
      out.putDecimal(rect.rows)
      out.putText(",C=1,")
    }
    out.putText("q=2,")
    out.putText(pixel < count ? "m=1;" : "m=0;")
    out.reserve(PIXELS_KITTY_CHUNK)
    // -1 only when `reserve` could not grow the buffer, which has set `full`.
    const end: i32 = base64EncodeIfFits(raw, 0, n, out.bytes, out.length)
    if (end < 0) {
      out.full = true
      return
    }
    out.length = end
    pixelsStringEnd(out)
  }
}

/** Panic, as `who`, unless `imageId` is a kitty image id: 1 or more, 0 being "no id". */
const pixelsCheckImageId = (who: string, imageId: i32): void => {
  if (imageId < 1) {
    panic(`${who}: an image id below 1`)
  }
}

/**
 * The kitty command that deletes the image `imageId`, every placement of it
 * and its data (`a=d,d=I`, the uppercase freeing the data), with `q=2` so the
 * terminal does not answer. A program writes it when it stops drawing, and
 * puts it in its terminal restore string, so the last frame does not stay
 * behind. Panics, like `kittyFrame`, on an id below 1.
 *
 * @param imageId The id `kittyFrame` drew with.
 * @returns The command, to `write`.
 */
export const kittyDelete = (imageId: i32): string => {
  pixelsCheckImageId("kittyDelete", imageId)
  return `\x1b_Ga=d,d=I,i=${imageId},q=2\x1b\\`
}

/**
 * The Sixel register of the palette colour with red level `r` (0–5), green `g`
 * (0–6) and blue `b` (0–5); -1, never met, for a level outside those, which
 * `sixelFrame` skips.
 */
const pixelsSixelRegister = (r: i32, g: i32, b: i32): i32 =>
  r >= 0 && r < 6 && g >= 0 && g < 7 && b >= 0 && b < 6 ? r * 42 + g * 6 + b : -1

/**
 * The level of one 0–255 component among `levels`, nearest, after `bias` (a
 * dither offset, 0 without dithering) is added and the sum clamped to 0–255.
 */
const pixelsLevel = (v: i32, bias: i32, levels: i32): i32 => {
  // In f64, which cannot overflow; every value is a small whole number, so it is exact.
  const x: f64 = Math.min(Math.max(toF64(v) + toF64(bias), 0.0), 255.0)
  return toI32(Math.floor((x * (toF64(levels) - 1.0) * 2.0 + 255.0) / 510.0))
}

/**
 * The dither offset for one component quantised to `levels`, at Bayer
 * threshold `t` (0–15): spread evenly over one quantisation step, centred on
 * zero, so a flat colour between two levels becomes a fixed pattern of both.
 */
const pixelsDitherBias = (t: i32, levels: i32): i32 => {
  // In f64, which cannot overflow or divide by zero, rounded toward zero.
  const q: f64 = ((toF64(t) * 2.0 - 15.0) * 255.0) / ((toF64(levels) - 1.0) * 32.0)
  return toI32(q < 0.0 ? Math.ceil(q) : Math.floor(q))
}

/** Append the sixel character for the six-pixel column `bits`, `count` times, run-length encoded. */
const pixelsSixelRun = (out: PixelBytes, bits: i32, count: i32): void => {
  // `bits` is six bits, 0 to 63; the test, never true for a run that is
  // written, proves the character in range.
  if (count <= 0 || bits < 0 || bits > 63) {
    return
  }
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
 * writes nothing; a rect wider than 2^31 - 1 / 252 pixels, or of more than
 * 2^31 - 1, is more than one buffer holds and marks `out` `full` instead.
 *
 * @param fb The frame's pixels; shrunk or grown to the rect by nearest neighbour.
 * @param rect Where to draw it, from `fitFramebuffer` with `GRAPHICS_SIXEL`.
 * @param dither Whether to dither gradients instead of banding them.
 * @param out Where the Sixel bytes are appended.
 */
export const sixelFrame = (fb: Framebuffer, rect: PixelRect, dither: boolean, out: PixelBytes): void => {
  const w: i32 = rect.width
  const h: i32 = rect.height
  if (w <= 0 || h <= 0 || fb.width <= 0 || fb.height <= 0) {
    return
  }
  // A rect whose working arrays would pass 2^31 - 1 entries is not a frame one
  // buffer can hold, as one whose bytes would not be.
  const wideArea: i64 = toI64(w) * toI64(h)
  const wideBits: i64 = toI64(w) * toI64(SIXEL_REGISTERS)
  const area: i32 = wideArea <= toI64(2147483647) ? toI32(wideArea) : -1
  const bitsArea: i32 = wideBits <= toI64(2147483647) ? toI32(wideBits) : -1
  if (area < 0 || bitsArea < 0) {
    out.full = true
    return
  }
  // The working arrays live on `out`, grown once to the largest frame.
  out.sampleXs = pixelsAtLeast(out.sampleXs, w)
  out.sampleYs = pixelsAtLeast(out.sampleYs, h)
  out.sixelReg = pixelsAtLeast(out.sixelReg, area)
  out.sixelBits = pixelsAtLeast(out.sixelBits, bitsArea)
  const xs: i32[] = out.sampleXs
  const ys: i32[] = out.sampleYs
  pixelsSampleMapInto(xs, w, fb.width)
  pixelsSampleMapInto(ys, h, fb.height)
  // Every destination pixel's register, and which registers the frame uses.
  const reg: i32[] = out.sixelReg
  const used: u8[] = out.sixelUsed
  used.fill(0)
  // `ys` is at least `h` long and `xs` `w`: bounding the loops by their lengths
  // too is what proves the reads in range.
  for (let y: i32 = 0; y < h && y < toI32(ys.length); y++) {
    const sy: i32 = ys[y]
    for (let x: i32 = 0; x < w && x < toI32(xs.length); x++) {
      // The sample maps hold pixels of `fb`, so this is never `get`'s black.
      const c: i32 = fb.get(xs[x], sy)
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
      // Always true: `reg` holds at least `w * h`, from `pixelsAtLeast`, which
      // the prover cannot see past; it proves the store in range.
      const at: i32 = pixelsIndex(x, y, w, toI32(reg.length))
      if (at >= 0 && at < toI32(reg.length)) {
        reg[at] = n
      }
      // Always true (a register is 0 to 251, or -1); it proves the store in range.
      if (n >= 0 && n < toI32(used.length)) {
        used[n] = 1
      }
    }
  }
  pixelsMoveTo(out, rect.col, rect.row)
  out.put(PIXELS_ESC)
  out.putText('Pq"1;1;')
  out.putDecimal(w)
  out.put(PIXELS_SEMICOLON)
  out.putDecimal(h)
  for (let n: i32 = 0; n < toI32(used.length) && n < SIXEL_REGISTERS; n++) {
    if (used[n] !== 0) {
      const r: i32 = (n / 42) | 0
      const g: i32 = ((n / 6) | 0) % 7
      const b: i32 = n % 6
      out.put(SIXEL_COLOUR)
      out.putDecimal(n)
      out.putText(";2;")
      out.putDecimal(toI32(Math.floor((toF64(r) * 100.0) / 5.0)))
      out.put(PIXELS_SEMICOLON)
      out.putDecimal(toI32(Math.floor((toF64(g) * 100.0) / 6.0)))
      out.put(PIXELS_SEMICOLON)
      out.putDecimal(toI32(Math.floor((toF64(b) * 100.0) / 5.0)))
    }
  }
  // Per band: the first and last column each register appears in, so a colour
  // is only walked over the span it covers, and each register's sixels across
  // the band, `n * w + x`, built in one pass over its pixels. Emitting a span
  // zeroes it, which leaves `bits` all zero for the next band and the next
  // frame.
  const first: i32[] = out.sixelFirst
  const last: i32[] = out.sixelLast
  const bits: i32[] = out.sixelBits
  for (let top: i32 = 0; top < h; ) {
    // `top` below the largest i32 less 6 proves `top + 6`.
    const bottom: i32 = top < 2147483641 && top + 6 < h ? top + 6 : h
    first.fill(-1)
    let nextBit: i32 = PIXELS_ONE
    for (let y: i32 = top; y < bottom; y++) {
      const bit: i32 = nextBit
      nextBit = nextBit << 1
      for (let x: i32 = 0; x < w; x++) {
        const at: i32 = pixelsIndex(x, y, w, toI32(reg.length))
        // Never taken, as where `reg` was written; it proves the read in range.
        if (at < 0 || at >= toI32(reg.length)) {
          continue
        }
        const n: i32 = reg[at]
        // `bits` holds a row of `w` for each register.
        const slot: i32 = pixelsIndex(x, n, w, toI32(bits.length))
        // Never taken (a register is 0 to 251, and `reg` and `bits` are
        // large enough); it proves the reads and stores below in range.
        if (
          n < 0 ||
          n >= toI32(first.length) ||
          n >= toI32(last.length) ||
          slot < 0 ||
          slot >= toI32(bits.length)
        ) {
          continue
        }
        bits[slot] = bits[slot] | bit
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
    for (let n: i32 = 0; n < toI32(first.length) && n < toI32(last.length); n++) {
      // Read once: the calls below drop what proves `n` in range.
      const start: i32 = first[n]
      const end: i32 = last[n]
      if (start < 0) {
        continue
      }
      if (!firstColour) {
        out.put(SIXEL_RETURN)
      }
      firstColour = false
      out.put(SIXEL_COLOUR)
      out.putDecimal(n)
      // Blank columns before the colour's first one, then its runs to its last.
      pixelsSixelRun(out, 0, start)
      // The run is `runBits` from column `runStart` up to `next`.
      let runBits: i32 = -1
      let runStart: i32 = start
      let next: i32 = start
      for (let x: i32 = start; x <= end && x < w; x++) {
        next = x + 1
        const slot: i32 = pixelsIndex(x, n, w, toI32(bits.length))
        // Never taken: `bits` holds a row of `w` for each register.
        if (slot < 0 || slot >= toI32(bits.length)) {
          continue
        }
        const sixel: i32 = bits[slot]
        bits[slot] = 0
        if (sixel !== runBits) {
          // `runStart` is never negative; the test says so for the prover.
          if (runStart >= 0 && x > runStart) {
            pixelsSixelRun(out, runBits, x - runStart)
          }
          runBits = sixel
          runStart = x
        }
      }
      if (runStart >= 0 && next > runStart) {
        pixelsSixelRun(out, runBits, toI32(toI64(next) - toI64(runStart)))
      }
    }
    top = bottom
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
 *
 * @param fb The frame's pixels.
 * @param canvas The half-block canvas of the screen to draw on.
 * @param rect Where to draw it, from `fitFramebuffer` with `GRAPHICS_HALFBLOCK`.
 */
export const drawHalfBlocks = (fb: Framebuffer, canvas: Canvas, rect: PixelRect): void => {
  if (rect.width <= 0 || rect.height <= 0 || fb.width <= 0 || fb.height <= 0) {
    return
  }
  const xs: i32[] = pixelsSampleMap(rect.width, fb.width)
  const ys: i32[] = pixelsSampleMap(rect.height, fb.height)
  // Read once: the calls below drop what the prover knows of fields.
  const left: i32 = rect.col
  const cw: i32 = canvas.width
  const ch: i32 = canvas.height
  const cpixels: i32[] = canvas.pixels
  // The rect's canvas rows run from `top` to `bottom`, two to a cell row; f64
  // holds them exactly for any rect. Walk only the part on the canvas.
  const top: f64 = toF64(rect.row) * 2.0
  const bottom: f64 = top + toF64(rect.rows) * 2.0
  let pyStart: i32 = 0
  if (top >= toF64(ch)) {
    pyStart = ch
  } else if (top > 0.0) {
    pyStart = toI32(top)
  }
  const pxStart: i32 = left > 0 ? left : 0
  for (let py: i32 = pyStart; py < ch && toF64(py) < bottom; py++) {
    // `py` is at least `top` and below `ch`, so `yRow` is a row of the rect;
    // it can pass 2^31 - 1 when the rect starts far above the canvas, so it is
    // checked against `ys` before it becomes an index.
    const yRow: f64 = toF64(py) - top
    const y: i32 = yRow < toF64(ys.length) ? toI32(yRow) : -1
    for (let px: i32 = pxStart; px < cw; px++) {
      const x: i64 = toI64(px) - toI64(left)
      // `xs` is `rect.width` long and `ys` `rect.height`: past them, the
      // rect ends.
      if (x >= toI64(xs.length)) {
        break
      }
      const at: i32 = pixelsIndex(px, py, cw, toI32(cpixels.length))
      // In range while the canvas's `pixels` holds `width * height`. Its fields
      // are public, and one set out of step with the others is a broken
      // canvas, which panics as indexing past `pixels` did, rather than skip
      // the pixel.
      if (at < 0 || at >= toI32(cpixels.length)) {
        panic("drawHalfBlocks: the canvas's pixels does not hold width × height")
      }
      // Never taken: `px` starts at `left` or past it, and `x` is below
      // `xs.length` from the test above; it proves the read in range.
      const sx: i32 = x < toI64(0) ? -1 : toI32(x)
      if (sx < 0 || sx >= toI32(xs.length)) {
        continue
      }
      cpixels[at] = y >= 0 && y < toI32(ys.length) ? fb.get(xs[sx], ys[y]) : COLOR_DEFAULT
    }
  }
  // The cell rows `rect.row` up to `rect.row + rect.rows`, those on the canvas.
  const rowEnd: i64 = toI64(rect.row) + toI64(rect.rows)
  const colEnd: i64 = toI64(left) + toI64(rect.width)
  for (let row: i32 = rect.row > 0 ? rect.row : 0; row < ch && toI64(row) < rowEnd; row++) {
    if (toI64(row) * toI64(2) >= toI64(ch)) {
      break
    }
    for (let col: i32 = pxStart; col < cw && toI64(col) < colEnd; col++) {
      canvas.paintCell(col, row)
    }
  }
}

/** The one of xterm's 16 standard colours nearest `colour` in RGB; a tie goes to the lower number. */
const pixelsNearestAnsi16 = (colour: i32): i32 => {
  const r: i32 = (colour >> 16) & 255
  const g: i32 = (colour >> 8) & 255
  const b: i32 = colour & 255
  let best: i32 = 0
  let bestDistance: f64 = 2147483647.0
  for (let i: i32 = 0; i < 16; i++) {
    const c: i32 = pixelsHex(PIXELS_ANSI16, i * 6, 6)
    const dr: i32 = r - ((c >> 16) & 255)
    const dg: i32 = g - ((c >> 8) & 255)
    const db: i32 = b - (c & 255)
    // Each difference is within 255 of zero; f64 holds the sum exactly, where
    // the prover cannot bound it in i32.
    const d: f64 = toF64(dr) * toF64(dr) + toF64(dg) * toF64(dg) + toF64(db) * toF64(db)
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
 *
 * @param fb The frame's pixels.
 * @param screen The screen to draw on.
 * @param rect Where to draw it, from `fitFramebuffer` with `GRAPHICS_ASCII`.
 * @param colors How many colours the terminal shows: 16 for the Linux console, anything else for more.
 */
export const drawAscii = (fb: Framebuffer, screen: Screen, rect: PixelRect, colors: i32): void => {
  if (rect.width <= 0 || rect.height <= 0 || fb.width <= 0 || fb.height <= 0) {
    return
  }
  const xs: i32[] = pixelsSampleMap(rect.width, fb.width)
  const ys: i32[] = pixelsSampleMap(rect.height, fb.height)
  // A local the prover can bound reads by.
  const rampText: string = PIXELS_RAMP
  const ramp: i32 = toI32(rampText.length)
  // `ys` is `rect.height` long and `xs` `rect.width`; bounding the loops by
  // their lengths proves the reads in range.
  for (let y: i32 = 0; y < toI32(ys.length); y++) {
    const sy: i32 = ys[y]
    // Past the largest i32 there is no screen row; `screen.set` drops rows
    // past its own height.
    const row: i64 = toI64(rect.row) + toI64(y)
    if (row > toI64(2147483647)) {
      break
    }
    for (let x: i32 = 0; x < toI32(xs.length); x++) {
      const col: i64 = toI64(rect.col) + toI64(x)
      if (col > toI64(2147483647)) {
        break
      }
      const c: i32 = fb.get(xs[x], sy)
      const luma: f64 = Math.floor(
        (toF64((c >> 16) & 255) * 299.0 + toF64((c >> 8) & 255) * 587.0 + toF64(c & 255) * 114.0) / 1000.0
      )
      const k: i32 = toI32(Math.floor((luma * toF64(ramp)) / 256.0))
      // Never taken: `luma` is below 256, so `k` is below `ramp`.
      if (k < 0 || k >= ramp) {
        continue
      }
      const glyph: i32 = toI32(rampText.charCodeAt(k))
      const fg: i32 = colors === 16 ? pixelsNearestAnsi16(c) : c
      screen.set(toI32(col), toI32(row), glyph, fg, COLOR_DEFAULT, ATTR_NONE)
    }
  }
}
