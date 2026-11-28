/**
 * `nish/raster` — software drawing into a frame of `0xRRGGBB` pixels: colour
 * arithmetic, rectangles, anti-aliased discs, additive glows, a vertical
 * gradient, a 5×7 pixel font, and two fixed pools that move and draw
 * themselves (a particle pool and a trail).
 *
 * **What it draws into.** Every drawing function takes the frame as three
 * arguments, `pixels: Int32Array, width: i32, height: i32`, row-major with
 * pixel `(x, y)` at `y * width + x`. An `Int32Array` parameter accepts both
 * kinds of frame a program has, so neither path copies:
 *
 * - a `nish/term-pixels` `Framebuffer` lends its `pixels` (an `i32[]`, which
 *   is the same type to `nish`) with its `width` and `height`, passed through
 *   `rasterFrame`, which returns the same array and exists only because `tsc`
 *   reads `Int32Array` as the JavaScript view (`runtime/nish.d.ts`);
 * - a wasm program lends an `Int32Array` it declares as module storage, which
 *   the page reads in place (`nish/host/game`'s frame is one).
 *
 * The functions only index the frame, which is what lets module storage be
 * lent to them. A frame shorter than `width * height` loses the rows it does
 * not hold, and everything is clipped to the frame, so no coordinate, however
 * wild, reads or writes outside it.
 *
 *     import { Framebuffer } from "nish/term-pixels";
 *     import { rasterDisc, rasterGradient, rasterRgb } from "nish/raster";
 *
 *     const fb = new Framebuffer(320, 180);
 *     const px = rasterFrame(fb.pixels);
 *     rasterGradient(px, fb.width, fb.height, rasterRgb(10, 10, 40), 0);
 *     rasterDisc(px, fb.width, fb.height, 160.0, 90.0, 12.0, 0xffcc00, 1.0);
 *
 * Shapes take pixel coordinates as `f64` where a fraction matters (a disc's
 * centre and radius) and as `i32` where it does not (a rectangle's edges).
 * The pools keep positions in whatever units the caller simulates in and draw
 * through a transform, `pixel = offset + v * scale`, so a game can keep its
 * world apart from the frame's size.
 *
 * Nothing here allocates after a pool is made, and every shape touches each
 * pixel it covers a bounded number of times, so a frame's cost follows the
 * frame's size. Pure: no capability, no I/O and no clock.
 */

/** The weight `rasterRect` and the mixes read as "all of the new colour". */
export const RASTER_SOLID: i32 = 256

/** A glyph's width in font pixels. */
export const RASTER_GLYPH_W: i32 = 5

/** A glyph's height in font pixels. */
export const RASTER_GLYPH_H: i32 = 7

/** The step from one glyph to the next in font pixels: the glyph and a one-pixel gap. */
export const RASTER_GLYPH_ADVANCE: i32 = 6

/** The largest font scale drawn; a larger one draws at this, so pixel arithmetic cannot overflow an `i32`. */
export const RASTER_MAX_TEXT_SCALE: i32 = 1024

/** Pixel coordinates are clamped to this before they become an `i32`. */
const RASTER_PIXEL_LIMIT: f64 = 1000000.0

/**
 * An `i32[]` frame as the `Int32Array` the drawing functions take: the same
 * array, not a copy, so drawing through the result draws into `pixels`.
 *
 * @param pixels - the frame, such as a `Framebuffer`'s `pixels`
 * @returns `pixels` itself
 */
export const rasterFrame = (pixels: i32[]): Int32Array => {
  // @ts-expect-error `Int32Array` is `i32[]` in Nish and a JavaScript view in lib.es5 (runtime/nish.d.ts).
  return pixels
}

// ---- Colour ----------------------------------------------------------------

/**
 * A pixel coordinate floored to an `i32`, clamped first so neither a huge
 * value nor NaN can overflow the conversion.
 *
 * @param v - the coordinate
 * @returns `floor(v)`, held to ±1000000; NaN is -1000000
 */
export const rasterPixel = (v: f64): i32 => {
  if (!(v > -RASTER_PIXEL_LIMIT)) {
    return -1000000
  }
  if (v > RASTER_PIXEL_LIMIT) {
    return 1000000
  }
  return toI32(Math.floor(v))
}

/** `v` clamped to a channel's 0..255. */
const rasterByte = (v: i32): integer<0, 255> => {
  if (v < 0) {
    return 0
  }
  if (v > 255) {
    return 255
  }
  return v
}

/** `x` held to 0..1; NaN becomes 0. */
const rasterUnit = (x: f64): f64 => {
  if (!(x > 0.0)) {
    return 0.0
  }
  return x > 1.0 ? 1.0 : x
}

/**
 * A colour from three channels.
 *
 * @param r - red, clamped to 0..255
 * @param g - green, clamped to 0..255
 * @param b - blue, clamped to 0..255
 * @returns the colour as `0xRRGGBB`
 */
export const rasterRgb = (r: i32, g: i32, b: i32): i32 =>
  (rasterByte(r) << 16) | (rasterByte(g) << 8) | rasterByte(b)

/**
 * A fraction as the 0..256 weight the mixes and `rasterRect` take.
 *
 * @param t - the fraction, clamped to 0..1; NaN is 0
 * @returns the weight, 0 to `RASTER_SOLID`
 */
export const rasterWeight = (t: f64): i32 => rasterWeightOf(t)

/** `rasterWeight`, typed as the 0..256 it returns, which is what lets a mix use it unchecked. */
const rasterWeightOf = (t: f64): integer<0, 256> => {
  if (!(t > 0.0)) {
    return 0
  }
  if (t >= 1.0) {
    return 256
  }
  const w: i32 = toI32(t * 256.0)
  // Never true: `t` is inside (0, 1), so `w` is 0..255. The test is what
  // proves the result in range, which the float product cannot.
  if (w < 0 || w > 256) {
    return 0
  }
  return w
}

/** A weight clamped to 0..256: at or below 0 is none of the new colour, at or above 256 all of it. */
const rasterClampWeight = (w: i32): integer<0, 256> => {
  if (w <= 0) {
    return 0
  }
  if (w >= 256) {
    return 256
  }
  return w
}

/** Channel `a` moved toward `b` by `w` 256ths. */
const rasterMixByte = (a: integer<0, 255>, b: integer<0, 255>, w: integer<0, 256>): i32 =>
  a + (((b - a) * w) >> 8)

/** The channel of colour `c` that sits `shift` bits up: 16 red, 8 green, 0 blue. */
const rasterChannel = (c: i32, shift: i32): integer<0, 255> => {
  const v: i32 = (c >> shift) & 255
  // Never true: the mask keeps eight bits. The test is what types the result
  // as a channel, which the mask alone does not.
  if (v < 0 || v > 255) {
    return 0
  }
  return v
}

/** `rasterMixWeight` for a weight already in 0..256, which a per-pixel loop holds once outside it. */
const rasterMixIn = (a: i32, b: i32, w: integer<0, 256>): i32 =>
  (rasterMixByte(rasterChannel(a, 16), rasterChannel(b, 16), w) << 16) |
  (rasterMixByte(rasterChannel(a, 8), rasterChannel(b, 8), w) << 8) |
  rasterMixByte(rasterChannel(a, 0), rasterChannel(b, 0), w)

/**
 * `a` moved toward `b` by a 0..256 weight, which a per-pixel loop computes
 * once with `rasterWeight`.
 *
 * @param a - the colour at weight 0
 * @param b - the colour at weight 256
 * @param w - the weight, clamped to 0..`RASTER_SOLID`
 * @returns the mixed colour
 */
export const rasterMixWeight = (a: i32, b: i32, w: i32): i32 => rasterMixIn(a, b, rasterClampWeight(w))

/**
 * `a` moved toward `b` by a fraction.
 *
 * @param a - the colour at 0
 * @param b - the colour at 1
 * @param t - how far, clamped to 0..1
 * @returns the mixed colour
 */
export const rasterMix = (a: i32, b: i32, t: f64): i32 => rasterMixIn(a, b, rasterWeightOf(t))

/**
 * Two colours added channel by channel, each saturating at 255: how light adds.
 *
 * @param a - one colour
 * @param b - the other
 * @returns the sum
 */
export const rasterAdd = (a: i32, b: i32): i32 =>
  (Math.min(((a >> 16) & 255) + ((b >> 16) & 255), 255) << 16) |
  (Math.min(((a >> 8) & 255) + ((b >> 8) & 255), 255) << 8) |
  Math.min((a & 255) + (b & 255), 255)

/**
 * A dimmer copy of the same hue.
 *
 * @param c - the colour
 * @param k - the factor every channel is multiplied by, clamped to 0..1
 * @returns the dimmed colour
 */
export const rasterDim = (c: i32, k: f64): i32 => rasterMixIn(0, c, rasterWeightOf(k))

/**
 * The fully saturated colour at a hue, so a rainbow is
 * `rasterHue(phase + i * step)`.
 *
 * @param h - the hue in turns: 0 is red, 1/3 green, 2/3 blue; any value wraps
 * @returns the colour
 */
export const rasterHue = (h: f64): i32 => {
  let turn: f64 = h - Math.floor(h)
  if (!(turn >= 0.0 && turn < 1.0)) {
    turn = 0.0
  }
  const h6: f64 = turn * 6.0
  const sector: i32 = toI32(Math.floor(h6))
  const rise: integer<0, 255> = rasterByte(toI32((h6 - Math.floor(h6)) * 255.0))
  const fall: i32 = 255 - rise
  if (sector === 0) {
    return rasterRgb(255, rise, 0)
  }
  if (sector === 1) {
    return rasterRgb(fall, 255, 0)
  }
  if (sector === 2) {
    return rasterRgb(0, 255, rise)
  }
  if (sector === 3) {
    return rasterRgb(0, fall, 255)
  }
  if (sector === 4) {
    return rasterRgb(rise, 0, 255)
  }
  return rasterRgb(255, 0, fall)
}

// ---- Shapes ----------------------------------------------------------------

/** The rows of a `width`-wide frame that `pixels` really holds, at most `height`. */
const rasterRows = (pixels: Int32Array, width: i32, height: i32): i32 => {
  if (width <= 0 || height <= 0) {
    return 0
  }
  return Math.min(height, toI32(pixels.length) / width)
}

/**
 * The index of pixel `(x, y)` in a `width`-wide frame of `size` pixels, or -1
 * when it is before the start or past the end. One past the last pixel is an
 * index, so a span that ends at the frame's end starts somewhere.
 */
const rasterAt = (size: i32, width: i32, x: i32, y: i32): i32 => {
  const at: i64 = toI64(y) * toI64(width) + toI64(x)
  if (at < 0 || at > toI64(size)) {
    return -1
  }
  return toI32(at)
}

/** Pixels `x0..x1` (exclusive) of row `y` set to `colour`, or blended by `w` 256ths below 256, clipped. */
const rasterSpan = (
  pixels: Int32Array,
  width: i32,
  rows: i32,
  x0: i32,
  x1: i32,
  y: i32,
  colour: i32,
  w: integer<0, 256>
): void => {
  if (y < 0 || y >= rows) {
    return
  }
  const from: i32 = Math.max(x0, 0)
  const to: i32 = Math.min(x1, width)
  const size: i32 = toI32(pixels.length)
  // `at` walks the row from pixel `from`: the loops end on `x`, and the row
  // is inside the frame because `y < rows`, so `at < size` never ends one.
  // It is what proves the index.
  let at: i32 = rasterAt(size, width, from, y)
  if (at < 0) {
    return
  }
  if (w >= RASTER_SOLID) {
    for (let x: i32 = from; x < to && at < size; x++) {
      pixels[at] = colour
      at = at + 1
    }
    return
  }
  for (let x: i32 = from; x < to && at < size; x++) {
    pixels[at] = rasterMixIn(pixels[at], colour, w)
    at = at + 1
  }
}

/** One past pixel `last`, held to `limit`: the exclusive end of a run that ends on `last`. */
const rasterEnd = (last: i32, limit: i32): i32 => (last >= limit ? limit : last + 1)

/** The weight of row `y` of a `height`-row gradient: 0 at the top, 256 at the bottom. */
const rasterGradientWeight = (y: i32, height: i32): integer<0, 256> => {
  if (height <= 1 || y <= 0) {
    return 0
  }
  if (y >= height - 1) {
    return 256
  }
  // In f64, where `y * 256` cannot overflow; the quotient of two exact
  // integers rounds to nearest, so truncating it is the integer quotient.
  const w: i32 = toI32((toF64(y) * 256.0) / toF64(height - 1))
  // Never true: `y` is inside `1..height - 2`, so `w` is under 256.
  if (w < 0 || w > 256) {
    return 0
  }
  return w
}

/**
 * Every pixel of the frame, as a vertical gradient: a background.
 *
 * @param pixels - the frame, row-major
 * @param width - the frame's width in pixels
 * @param height - the frame's height in pixels
 * @param top - the colour of the first row
 * @param bottom - the colour of the last row
 */
export const rasterGradient = (pixels: Int32Array, width: i32, height: i32, top: i32, bottom: i32): void => {
  const rows: i32 = rasterRows(pixels, width, height)
  for (let y: i32 = 0; y < rows; y++) {
    const colour: i32 = rasterMixIn(top, bottom, rasterGradientWeight(y, height))
    rasterSpan(pixels, width, rows, 0, width, y, colour, 256)
  }
}

/**
 * The pixel rectangle `x0..x1` × `y0..y1` (right and bottom exclusive) set to
 * a colour or blended toward it, clipped to the frame.
 *
 * @param pixels - the frame, row-major
 * @param width - the frame's width in pixels
 * @param height - the frame's height in pixels
 * @param x0 - the first column
 * @param y0 - the first row
 * @param x1 - one past the last column
 * @param y1 - one past the last row
 * @param colour - the colour, `0xRRGGBB`
 * @param weight - how much of `colour`, 0 to `RASTER_SOLID` (see `rasterWeight`); 0 draws nothing
 */
export const rasterRect = (
  pixels: Int32Array,
  width: i32,
  height: i32,
  x0: i32,
  y0: i32,
  x1: i32,
  y1: i32,
  colour: i32,
  weight: i32
): void => {
  if (weight <= 0) {
    return
  }
  const w: integer<0, 256> = rasterClampWeight(weight)
  const rows: i32 = rasterRows(pixels, width, height)
  const from: i32 = Math.max(y0, 0)
  const to: i32 = Math.min(y1, rows)
  for (let y: i32 = from; y < to; y++) {
    rasterSpan(pixels, width, rows, x0, x1, y, colour, w)
  }
}

/**
 * A disc blended over what is there, its edge anti-aliased: each pixel is
 * weighed by how much of it the circle covers, so a disc a few pixels wide
 * still looks round, and one narrower than a pixel fades out rather than stay
 * a grey dot.
 *
 * @param pixels - the frame, row-major
 * @param width - the frame's width in pixels
 * @param height - the frame's height in pixels
 * @param cx - the centre's x in pixels
 * @param cy - the centre's y in pixels
 * @param r - the radius in pixels; 0 or less draws nothing
 * @param colour - the colour, `0xRRGGBB`
 * @param alpha - the opacity, clamped to 0..1
 */
export const rasterDisc = (
  pixels: Int32Array,
  width: i32,
  height: i32,
  cx: f64,
  cy: f64,
  r: f64,
  colour: i32,
  alpha: f64
): void => {
  const a: f64 = rasterUnit(alpha) * rasterUnit(r * 2.0)
  if (!(r > 0.0) || a <= 0.0) {
    return
  }
  const rows: i32 = rasterRows(pixels, width, height)
  const inner: f64 = r > 0.5 ? (r - 0.5) * (r - 0.5) : 0.0
  const outer: f64 = (r + 0.5) * (r + 0.5)
  const fullW: integer<0, 256> = rasterWeightOf(a)
  const size: i32 = toI32(pixels.length)
  const x0: i32 = Math.max(rasterPixel(cx - r - 1.0), 0)
  const x1: i32 = rasterEnd(rasterPixel(cx + r + 1.0), width)
  const y0: i32 = Math.max(rasterPixel(cy - r - 1.0), 0)
  const y1: i32 = rasterEnd(rasterPixel(cy + r + 1.0), rows)
  for (let y: i32 = y0; y < y1; y++) {
    const dy: f64 = toF64(y) + 0.5 - cy
    // `at` walks the row as `rasterSpan`'s does.
    let at: i32 = rasterAt(size, width, x0, y)
    if (at < 0) {
      return
    }
    for (let x: i32 = x0; x < x1 && at < size; x++) {
      const dx: f64 = toF64(x) + 0.5 - cx
      const d2: f64 = dx * dx + dy * dy
      if (d2 < outer) {
        const w: integer<0, 256> = d2 <= inner ? fullW : rasterWeightOf((r + 0.5 - Math.sqrt(d2)) * a)
        pixels[at] = w >= RASTER_SOLID ? colour : rasterMixIn(pixels[at], colour, w)
      }
      at = at + 1
    }
  }
}

/**
 * Light added around a point, brightest at the centre and falling off with the
 * square of the distance: a halo.
 *
 * @param pixels - the frame, row-major
 * @param width - the frame's width in pixels
 * @param height - the frame's height in pixels
 * @param cx - the centre's x in pixels
 * @param cy - the centre's y in pixels
 * @param r - the radius in pixels the light reaches; 0 or less draws nothing
 * @param colour - the light's colour, `0xRRGGBB`
 * @param strength - how much: 1 adds the full colour at the centre
 */
export const rasterGlow = (
  pixels: Int32Array,
  width: i32,
  height: i32,
  cx: f64,
  cy: f64,
  r: f64,
  colour: i32,
  strength: f64
): void => {
  if (!(r > 0.0) || !(strength > 0.0)) {
    return
  }
  const rows: i32 = rasterRows(pixels, width, height)
  const r2: f64 = r * r
  const size: i32 = toI32(pixels.length)
  const x0: i32 = Math.max(rasterPixel(cx - r), 0)
  const x1: i32 = rasterEnd(rasterPixel(cx + r), width)
  const y0: i32 = Math.max(rasterPixel(cy - r), 0)
  const y1: i32 = rasterEnd(rasterPixel(cy + r), rows)
  for (let y: i32 = y0; y < y1; y++) {
    const dy: f64 = toF64(y) + 0.5 - cy
    // `at` walks the row as `rasterSpan`'s does.
    let at: i32 = rasterAt(size, width, x0, y)
    if (at < 0) {
      return
    }
    for (let x: i32 = x0; x < x1 && at < size; x++) {
      const dx: f64 = toF64(x) + 0.5 - cx
      const d2: f64 = dx * dx + dy * dy
      if (d2 < r2) {
        const near: f64 = d2 / r2
        const fall: f64 = 1.0 - near
        const w: integer<0, 256> = rasterWeightOf(fall * fall * strength)
        if (w > 0) {
          pixels[at] = rasterAdd(pixels[at], rasterMixIn(0, colour, w))
        }
      }
      at = at + 1
    }
  }
}

// ---- Text ------------------------------------------------------------------

/**
 * The 5×7 font, ASCII 32 to 126: seven characters a glyph, one a row from the
 * top, each the row's five pixels as bits (16 the leftmost) plus 48, so every
 * character is a digit, one of `:;<=>?@` or `A` to `O`. A string is the one
 * table a module constant can be, so the font costs no allocation and no code
 * to build it.
 */
const RASTER_FONT: string =
  // space to -
  "00000004444404::00000:O::O:04?D>5N4HI248C3<BD8EB=4480000248884284222480:4O4:0044O44000000<4000O000" +
  // . to ;
  "00000<<01248@0>ACEIA>4<4444>>A168@O>A161A>26:BO22O@N11A>68@NAA>O124888>AA>AA>>AA?12<0<<0<<00<<0<48" +
  // < to I
  "248@84200O0O008421248>A12404>AGEG@>>AAOAAANAANAAN>A@@@A>LBAAABLO@@N@@OO@@N@@@>A@GAA?AAAOAAA>44444>" +
  // J to W
  "72222B<ABDHDBA@@@@@@OAKEEAAAAAIECAA>AAAAA>NAAN@@@>AAAEB=NAANDBA?@@>11NO444444AAAAAA>AAAAA:4AAAEEE:" +
  // X to e
  "AA:4:AAAA:4444O1248@O>88888>0@84210>22222>4:A0000000000O840000000>1?A?@@NAAAN00>@@A>11?AAA?00>AO@>" +
  // f to s
  "698L8880?AA?1>@@FIAAA40<444>20622B<@@BDHDB<44444>00JEEAA00FIAAA00>AAA>00NAN@@00?A?1100FI@@@00?@>1N" +
  // t to ~
  "88L889600AAAC=00AAA:400AAEE:00A:4:A00AA?1>00O248O244844244444448442448008E200"

/** The glyph number of byte `c`, its place in the font from 0 for a space; a byte outside 32..126 is `?`'s. */
const rasterGlyph = (c: i32): integer<0, 94> => {
  const g: i32 = c - 32
  if (g < 0 || g > 94) {
    return 31
  }
  return g
}

/** The bits of row `row` of the glyph for byte `c` in `font`, which is `RASTER_FONT`. */
const rasterGlyphRow = (font: string, c: i32, row: i32): i32 => {
  // 7 is `RASTER_GLYPH_H`, written out so the prover sees the product's bound.
  if (row < 0 || row >= 7) {
    return 0
  }
  const at: i32 = rasterGlyph(c) * 7 + row
  // `at < 0` is never true, but the bound on the sum does not survive into `at`.
  if (at < 0 || at >= toI32(font.length)) {
    return 0
  }
  return toI32(font.charCodeAt(at)) - 48
}

/**
 * The width text takes in the 5×7 font: six font pixels a glyph, less the
 * last gap.
 *
 * @param text - the text, one glyph a byte, so a character outside ASCII takes one per UTF-8 byte
 * @param scale - the font scale, frame pixels per font pixel
 * @returns the width in frame pixels, 0 for empty text or a scale under 1
 */
export const rasterTextWidth = (text: string, scale: i32): i32 => {
  const n: i32 = toI32(text.length)
  if (n === 0 || scale < 1) {
    return 0
  }
  // In i64: a string long enough to be wider than an `i32` saturates.
  const size: integer<0, 1024> = rasterTextScale(scale)
  // 6 is `RASTER_GLYPH_ADVANCE`, written out so the prover sees the bound.
  const advance: i64 = toI64(size) * 6
  return rasterEdge(toI64(n) * advance - toI64(size))
}

/** `v` held to the `i32` range, which keeps which side of a frame's edge it is on. */
const rasterEdge = (v: i64): i32 => {
  if (v < -2147483648) {
    return -2147483648
  }
  if (v > 2147483647) {
    return 2147483647
  }
  return toI32(v)
}

/** A text scale held to 1..`RASTER_MAX_TEXT_SCALE`, or 0 for one under 1, which draws nothing. */
const rasterTextScale = (scale: i32): integer<0, 1024> => {
  if (scale < 0) {
    return 0
  }
  // 1024 is `RASTER_MAX_TEXT_SCALE`, written out because a range takes a literal.
  if (scale > 1024) {
    return 1024
  }
  return scale
}

/**
 * Text in the 5×7 font, each font pixel a `scale` × `scale` block of frame
 * pixels. Text is pixel art, so it sits on whole pixels and is never blended.
 * A byte outside ASCII 32..126 draws as `?`, so a character outside ASCII
 * draws as one `?` for each of its UTF-8 bytes.
 *
 * @param pixels - the frame, row-major
 * @param width - the frame's width in pixels
 * @param height - the frame's height in pixels
 * @param x - the left edge in pixels
 * @param y - the top edge in pixels
 * @param scale - the font scale; under 1 draws nothing, over `RASTER_MAX_TEXT_SCALE` draws at that
 * @param text - the text
 * @param colour - the colour, `0xRRGGBB`
 */
export const rasterText = (
  pixels: Int32Array,
  width: i32,
  height: i32,
  x: i32,
  y: i32,
  scale: i32,
  text: string,
  colour: i32
): void => {
  const size: integer<0, 1024> = rasterTextScale(scale)
  if (size < 1) {
    return
  }
  const n: i32 = toI32(text.length)
  // Positions are i64, where a glyph past either edge cannot overflow; each
  // is held to the `i32` range at the draw, which keeps it past that edge.
  const step: i64 = toI64(size)
  // 5 and 6 are `RASTER_GLYPH_W` and `RASTER_GLYPH_ADVANCE`, written out so the
  // prover sees each product's bound.
  const wide: i64 = step * 5
  const advance: i64 = step * 6
  for (let i: i32 = 0; i < n; i++) {
    // Held to the `i32` range, which changes nothing drawn: a glyph clamped
    // to the top is past the right edge and ends the text, and one clamped to
    // the bottom is wholly left of the frame and skipped. `top` and `left`
    // are clamped the same way, so their blocks are clipped whole.
    const gx: i32 = rasterEdge(toI64(x) + toI64(i) * advance)
    if (gx >= width) {
      return
    }
    const c: i32 = toI32(text.charCodeAt(i))
    if (toI64(gx) + wide > 0) {
      for (let row: i32 = 0; row < RASTER_GLYPH_H; row++) {
        const bits: i32 = rasterGlyphRow(RASTER_FONT, c, row)
        const top: i32 = rasterEdge(toI64(y) + toI64(row) * step)
        for (let col: i32 = 0; col < RASTER_GLYPH_W; col++) {
          if (((bits >> (RASTER_GLYPH_W - 1 - col)) & 1) !== 0) {
            const left: i32 = rasterEdge(toI64(gx) + toI64(col) * step)
            rasterRect(
              pixels,
              width,
              height,
              left,
              top,
              rasterEdge(toI64(left) + step),
              rasterEdge(toI64(top) + step),
              colour,
              RASTER_SOLID
            )
          }
        }
      }
    }
  }
}

// ---- Trail -----------------------------------------------------------------

/**
 * The last positions of something moving, newest last, in a ring made once:
 * what `rasterTrail` draws behind it. `rasterPushTrail` adds a point; a full
 * ring forgets its oldest. Positions are in the caller's units.
 */
export class RasterTrail {
  /** The x of each point, in ring order. */
  xs: f64[]
  /** The y of each point, in ring order. */
  ys: f64[]
  /** The slot the next point goes in. */
  head: i32
  /** The points held, up to the capacity. */
  count: i32

  /**
   * An empty trail.
   *
   * @param capacity - the points it remembers, at least one
   */
  constructor(capacity: i32) {
    // Written as a test, not `Math.max`, so the prover sees `n` is
    // positive at each `new Array` below.
    let n: i32 = 1
    if (capacity > 1) {
      n = capacity
    }
    this.xs = new Array<f64>(n)
    this.xs.fill(0.0)
    this.ys = new Array<f64>(n)
    this.ys.fill(0.0)
    this.head = 0
    this.count = 0
  }

  /** Forget every point. */
  clear(): void {
    this.head = 0
    this.count = 0
  }
}

/**
 * Add the newest point to a trail, forgetting the oldest when it is full.
 *
 * @param trail - the trail
 * @param x - the point's x
 * @param y - the point's y
 */
export const rasterPushTrail = (trail: RasterTrail, x: f64, y: f64): void => {
  const xs: f64[] = trail.xs
  const ys: f64[] = trail.ys
  const n: i32 = toI32(xs.length)
  const head: i32 = trail.head
  if (head < 0 || head >= n || n !== toI32(ys.length) || head >= toI32(ys.length)) {
    trail.head = 0
    return
  }
  xs[head] = x
  ys[head] = y
  trail.head = head + 1 >= n ? 0 : head + 1
  const count: i32 = trail.count
  if (count < n) {
    trail.count = count + 1
  }
}

/**
 * A trail as a line of discs from oldest to newest, each larger and more
 * opaque than the one before: a streak that fades out behind what made it.
 * A point at `v` is drawn at pixel `offset + v * scale`. A `head` set
 * outside the ring still draws the points `count` slots behind it that land
 * in the ring, as an in-range head does, and no others.
 *
 * @param pixels - the frame, row-major
 * @param width - the frame's width in pixels
 * @param height - the frame's height in pixels
 * @param trail - the trail
 * @param r - the newest disc's radius, in the trail's units
 * @param colour - the colour, `0xRRGGBB`
 * @param alpha - the newest disc's opacity
 * @param scale - frame pixels per trail unit
 * @param offsetX - the pixel x of trail x 0
 * @param offsetY - the pixel y of trail y 0
 */
export const rasterTrail = (
  pixels: Int32Array,
  width: i32,
  height: i32,
  trail: RasterTrail,
  r: f64,
  colour: i32,
  alpha: f64,
  scale: f64,
  offsetX: f64,
  offsetY: f64
): void => {
  const xs: f64[] = trail.xs
  const ys: f64[] = trail.ys
  const n: i32 = toI32(xs.length)
  const count: i32 = Math.min(trail.count, n)
  const head: i32 = trail.head
  // The oldest point is `count` slots behind the head, wrapping once. A head
  // out of the ring (a caller can set the field) still has the slots that land
  // in it drawn. Point i sits at `head - count + i`, counted in f64, where it
  // is exact for any head, so no sum can overflow. The points before slot 0
  // wrap to the ring's end and are older than the rest, so they are drawn
  // first, as one run of slots, and the others as a second.
  if (count <= 0) {
    return
  }
  const size: f64 = toF64(n)
  const ysLength: i32 = toI32(ys.length)
  const first: f64 = toF64(head) - toF64(count)
  const steps: f64 = toF64(count) + 1.0
  for (let pass: i32 = 0; pass < 2; pass++) {
    // Point i of this run sits at slot `base + i`.
    const base: f64 = pass === 0 ? first + size : first
    const lo: f64 = Math.max(base, 0.0)
    const hi: f64 = Math.min(base + toF64(count), size)
    if (lo < hi) {
      const end: i32 = toI32(hi)
      // How far along the trail the point is, from 1 for the oldest.
      let step: f64 = lo - base + 1.0
      for (let slot: i32 = toI32(lo); slot < end; slot++) {
        // The first two are always true in the run and prove the indexes; the
        // third skips a slot a shorter `ys` does not hold.
        if (slot >= 0 && slot < n && slot < ysLength) {
          const f: f64 = step / steps
          const radius: f64 = r * (f * 0.6 + 0.4)
          const cx: f64 = offsetX + xs[slot] * scale
          const cy: f64 = offsetY + ys[slot] * scale
          rasterDisc(pixels, width, height, cx, cy, radius * scale, colour, alpha * f)
        }
        step = step + 1.0
      }
    }
  }
}

// ---- Particles -------------------------------------------------------------

/**
 * A fixed pool of particles: sparks, debris, fireworks. Each particle's
 * position, previous position, velocity, colour, size and life sit in parallel
 * arrays made once, so spawning, stepping and drawing allocate nothing. Slots
 * are reused in spawn order, so when every slot is live a new particle
 * replaces the oldest. Positions and sizes are in the caller's units, speeds
 * in those units a second.
 */
export class RasterParticles {
  /** x now. */
  xs: f64[]
  /** y now. */
  ys: f64[]
  /** x a step ago, which a draw interpolates from. */
  prevXs: f64[]
  /** y a step ago. */
  prevYs: f64[]
  /** Units a second across. */
  vxs: f64[]
  /** Units a second down. */
  vys: f64[]
  /** Seconds of life left; a particle at or under 0 is dead. */
  lives: f64[]
  /** The seconds of life each particle was spawned with, which its fade is measured against. */
  spans: f64[]
  /** The side of each particle's square. */
  sizes: f64[]
  /** Each particle's colour. */
  colours: i32[]
  /** The slot the next spawn takes: the oldest. */
  next: i32

  /**
   * A pool of dead particles.
   *
   * @param capacity - the particles it holds at once, at least one
   */
  constructor(capacity: i32) {
    // Written as a test, not `Math.max`, so the prover sees `n` is
    // positive at each `new Array` below.
    let n: i32 = 1
    if (capacity > 1) {
      n = capacity
    }
    this.xs = new Array<f64>(n)
    this.xs.fill(0.0)
    this.ys = new Array<f64>(n)
    this.ys.fill(0.0)
    this.prevXs = new Array<f64>(n)
    this.prevXs.fill(0.0)
    this.prevYs = new Array<f64>(n)
    this.prevYs.fill(0.0)
    this.vxs = new Array<f64>(n)
    this.vxs.fill(0.0)
    this.vys = new Array<f64>(n)
    this.vys.fill(0.0)
    this.lives = new Array<f64>(n)
    this.lives.fill(0.0)
    this.spans = new Array<f64>(n)
    this.spans.fill(1.0)
    this.sizes = new Array<f64>(n)
    this.sizes.fill(1.0)
    this.colours = new Array<i32>(n)
    this.colours.fill(0)
    this.next = 0
  }

  /**
   * How many particles the pool holds at once.
   *
   * @returns the capacity
   */
  capacity(): i32 {
    return toI32(this.lives.length)
  }

  /**
   * How many particles are alive.
   *
   * @returns the live count
   */
  live(): i32 {
    const lives: f64[] = this.lives
    const len: i32 = toI32(lives.length)
    let n: i32 = 0
    for (const life of lives) {
      // `n < len` is never false: it counts at most the array's elements. It
      // is what proves the increment.
      if (life > 0.0 && n < len) {
        n = n + 1
      }
    }
    return n
  }

  /** Kill every particle. */
  clear(): void {
    this.lives.fill(0.0)
    this.next = 0
  }

  /**
   * Whether a slot is in every one of the parallel arrays, which the pool
   * keeps the same length.
   *
   * @param i - the slot
   * @returns true when every array has slot `i`
   */
  has(i: i32): boolean {
    const n: i32 = this.capacity()
    return (
      i >= 0 &&
      i < n &&
      n === toI32(this.xs.length) &&
      n === toI32(this.ys.length) &&
      n === toI32(this.prevXs.length) &&
      n === toI32(this.prevYs.length) &&
      n === toI32(this.vxs.length) &&
      n === toI32(this.vys.length) &&
      n === toI32(this.spans.length) &&
      n === toI32(this.sizes.length) &&
      n === toI32(this.colours.length)
    )
  }
}

/**
 * A new particle in the pool's oldest slot, live or not, so a full pool
 * replaces its oldest particle.
 *
 * @param pool - the pool
 * @param x - the centre's x
 * @param y - the centre's y
 * @param vx - units a second across
 * @param vy - units a second down
 * @param life - seconds it lives; 0 or less spawns it dead
 * @param size - the side of its square
 * @param colour - its colour, `0xRRGGBB`
 */
export const rasterSpawnParticle = (
  pool: RasterParticles,
  x: f64,
  y: f64,
  vx: f64,
  vy: f64,
  life: f64,
  size: f64,
  colour: i32
): void => {
  const xs: f64[] = pool.xs
  const ys: f64[] = pool.ys
  const prevXs: f64[] = pool.prevXs
  const prevYs: f64[] = pool.prevYs
  const vxs: f64[] = pool.vxs
  const vys: f64[] = pool.vys
  const lives: f64[] = pool.lives
  const spans: f64[] = pool.spans
  const sizes: f64[] = pool.sizes
  const colours: i32[] = pool.colours
  const i: i32 = pool.next
  // `pool.has(i)` refuses a pool whose arrays differ in length; the tests
  // after it restate that against each array the stores below index.
  if (
    !pool.has(i) ||
    i < 0 ||
    i >= toI32(lives.length) ||
    i >= toI32(xs.length) ||
    i >= toI32(ys.length) ||
    i >= toI32(prevXs.length) ||
    i >= toI32(prevYs.length) ||
    i >= toI32(vxs.length) ||
    i >= toI32(vys.length) ||
    i >= toI32(spans.length) ||
    i >= toI32(sizes.length) ||
    i >= toI32(colours.length)
  ) {
    pool.next = 0
    return
  }
  xs[i] = x
  ys[i] = y
  prevXs[i] = x
  prevYs[i] = y
  vxs[i] = vx
  vys[i] = vy
  lives[i] = life > 0.0 ? life : 0.0
  spans[i] = life > 0.0 ? life : 1.0
  sizes[i] = size
  colours[i] = colour
  pool.next = i + 1 >= toI32(lives.length) ? 0 : i + 1
}

/**
 * One step of a pool: every live particle falls, slows, moves and ages.
 *
 * @param pool - the pool
 * @param dt - the step in seconds
 * @param gravity - units a second squared, down
 * @param drag - the fraction of its speed a particle loses a second
 */
export const rasterStepParticles = (pool: RasterParticles, dt: f64, gravity: f64, drag: f64): void => {
  const lost: f64 = drag * dt
  const keep: f64 = rasterUnit(1.0 - lost)
  const xs: f64[] = pool.xs
  const ys: f64[] = pool.ys
  const prevXs: f64[] = pool.prevXs
  const prevYs: f64[] = pool.prevYs
  const vxs: f64[] = pool.vxs
  const vys: f64[] = pool.vys
  const lives: f64[] = pool.lives
  const n: i32 = toI32(lives.length)
  // A pool whose arrays differ in length steps nothing, as `pool.has` decides.
  if (!pool.has(toI32(0))) {
    return
  }
  for (let i: i32 = 0; i < n; i++) {
    // Past the test above the arrays are one length, so this skips only dead
    // slots; the length tests are what prove each index.
    if (
      i >= toI32(xs.length) ||
      i >= toI32(ys.length) ||
      i >= toI32(prevXs.length) ||
      i >= toI32(prevYs.length) ||
      i >= toI32(vxs.length) ||
      i >= toI32(vys.length) ||
      lives[i] <= 0.0
    ) {
      continue
    }
    prevXs[i] = xs[i]
    prevYs[i] = ys[i]
    vxs[i] = vxs[i] * keep
    vys[i] = (vys[i] + gravity * dt) * keep
    xs[i] = xs[i] + vxs[i] * dt
    ys[i] = ys[i] + vys[i] * dt
    lives[i] = lives[i] - dt
  }
}

/**
 * Every live particle of a pool as a square blended over the frame, at its
 * position `alpha` of the way from the last step to this one and faded by the
 * life it has left. A position `v` is drawn at pixel `offset + v * scale`.
 *
 * @param pixels - the frame, row-major
 * @param width - the frame's width in pixels
 * @param height - the frame's height in pixels
 * @param pool - the pool
 * @param alpha - how far between the last step and this one, 0..1
 * @param scale - frame pixels per pool unit
 * @param offsetX - the pixel x of pool x 0
 * @param offsetY - the pixel y of pool y 0
 */
export const rasterParticles = (
  pixels: Int32Array,
  width: i32,
  height: i32,
  pool: RasterParticles,
  alpha: f64,
  scale: f64,
  offsetX: f64,
  offsetY: f64
): void => {
  const xs: f64[] = pool.xs
  const ys: f64[] = pool.ys
  const prevXs: f64[] = pool.prevXs
  const prevYs: f64[] = pool.prevYs
  const lives: f64[] = pool.lives
  const spans: f64[] = pool.spans
  const sizes: f64[] = pool.sizes
  const colours: i32[] = pool.colours
  const n: i32 = toI32(lives.length)
  // As in `rasterStepParticles`: a malformed pool draws nothing.
  if (!pool.has(toI32(0))) {
    return
  }
  for (let i: i32 = 0; i < n; i++) {
    // As in `rasterStepParticles`: only dead slots are skipped.
    if (
      i >= toI32(xs.length) ||
      i >= toI32(ys.length) ||
      i >= toI32(prevXs.length) ||
      i >= toI32(prevYs.length) ||
      i >= toI32(spans.length) ||
      i >= toI32(sizes.length) ||
      i >= toI32(colours.length) ||
      lives[i] <= 0.0
    ) {
      continue
    }
    const size: f64 = sizes[i]
    const half: f64 = size / 2.0
    const x: f64 = prevXs[i] + (xs[i] - prevXs[i]) * alpha - half
    const y: f64 = prevYs[i] + (ys[i] - prevYs[i]) * alpha - half
    const x0: i32 = rasterPixel(offsetX + x * scale + 0.5)
    const y0: i32 = rasterPixel(offsetY + y * scale + 0.5)
    const x1: i32 = rasterPixel(offsetX + (x + size) * scale + 0.5)
    const y1: i32 = rasterPixel(offsetY + (y + size) * scale + 0.5)
    const weight: i32 = rasterWeight(lives[i] / spans[i])
    rasterRect(pixels, width, height, x0, y0, x1, y1, colours[i], weight)
  }
}
