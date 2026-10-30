// The drawing kit behind `nish break`, the brick breaker hidden in the CLI.
// The menu and the game both draw through it, so it holds everything they
// share and nothing either owns: the fixed world and the view that maps it onto
// a framebuffer, the shapes, a pixel font, colour and easing arithmetic, and
// two fixed pools (a trail and particles).
//
// Simulation lives in a 320×180 world measured in `f64` units that knows
// nothing of pixels; a `View` maps it onto whatever `Framebuffer` the terminal
// backend hands over, from a tiny half-block canvas to a 960×540 kitty image.
// Every shape takes world coordinates, goes through the view and is clipped to
// the framebuffer, so a resize never touches game state.
//
// Two rules shape the code. Nothing here allocates after construction, because
// a collection pause in a game stepping 120 times a second is a dropped frame;
// the pools are made once and reused. And each shape touches each pixel it
// covers a bounded number of times with plain arithmetic, so draw cost follows
// the framebuffer's size.

import { Framebuffer } from "../std/term-pixels"

/** Simulation steps a second: every duration the game and menu count is in these steps. */
export const STEPS_PER_SECOND: i32 = 120

/** The world's width in world units. */
export const WORLD_W: f64 = 320.0

/** The world's height in world units: 16:9 with `WORLD_W`. */
export const WORLD_H: f64 = 180.0

/** A glyph's width in font pixels. */
export const GLYPH_W: i32 = 5

/** A glyph's height in font pixels: what `fontScaleFor` multiplies. */
export const GLYPH_H: i32 = 7

/** The step from one glyph to the next in font pixels: the glyph and a one-pixel gap. */
export const GLYPH_ADVANCE: i32 = 6

/** The shadow colour that means "no shadow" to `drawTextCentred`. */
export const NO_SHADOW: i32 = -1

/** The largest font scale drawn; a larger one draws at this, so pixel arithmetic cannot overflow an `i32`. */
const GFX_MAX_TEXT_SCALE: i32 = 1024

/** Pixel coordinates are clamped to this before they become an `i32`, so a wild world value cannot overflow. */
const GFX_PIXEL_LIMIT: f64 = 1000000.0

/**
 * Where the world sits in a framebuffer. `scale` is framebuffer pixels per
 * world unit, the same on both axes; `offsetX` and `offsetY` are the pixel
 * position of the world's origin, letterbox and shake included. The
 * `left`..`bottom` rectangle is the unshaken world in pixels (right and bottom
 * exclusive), which is what `fillLetterbox` paints around.
 *
 * Drawing reads `scale` to pick its detail: a glow radius, a bevel width, a
 * font scale.
 */
export class View {
  /** The framebuffer every shape draws into. */
  fb: Framebuffer
  /** Framebuffer pixels per world unit; 0 for an empty framebuffer, which then draws nothing. */
  scale: f64
  /** The pixel x of world x 0, shake included. */
  offsetX: f64
  /** The pixel y of world y 0, shake included. */
  offsetY: f64
  /** The shake in world units that `offsetX` includes. */
  shakeX: f64
  /** The shake in world units that `offsetY` includes. */
  shakeY: f64
  /** The first pixel column of the unshaken world. */
  left: i32
  /** The first pixel row of the unshaken world. */
  top: i32
  /** One past the last pixel column of the unshaken world. */
  right: i32
  /** One past the last pixel row of the unshaken world. */
  bottom: i32

  /** A view of an empty framebuffer; `viewFor` points it at a real one. */
  constructor() {
    this.fb = new Framebuffer(0, 0)
    this.scale = 0.0
    this.offsetX = 0.0
    this.offsetY = 0.0
    this.shakeX = 0.0
    this.shakeY = 0.0
    this.left = 0
    this.top = 0
    this.right = 0
    this.bottom = 0
  }
}

/**
 * Fit the world into `fb`, centred and letterboxed, and shift it by the shake
 * (in world units). It writes into `view` rather than making a new one, so a
 * frame costs no allocation.
 */
export const viewFor = (view: View, fb: Framebuffer, shakeX: f64, shakeY: f64): void => {
  const w: f64 = toF64(fb.width)
  const h: f64 = toF64(fb.height)
  const scale: f64 = Math.min(w / WORLD_W, h / WORLD_H)
  const baseX: f64 = Math.floor((w - WORLD_W * scale) / 2.0)
  const baseY: f64 = Math.floor((h - WORLD_H * scale) / 2.0)
  view.fb = fb
  view.scale = scale
  view.shakeX = shakeX
  view.shakeY = shakeY
  view.offsetX = baseX + shakeX * scale
  view.offsetY = baseY + shakeY * scale
  view.left = gfxPixel(baseX)
  view.top = gfxPixel(baseY)
  view.right = gfxPixel(baseX + WORLD_W * scale + 0.5)
  view.bottom = gfxPixel(baseY + WORLD_H * scale + 0.5)
}

/** The pixel column of world `x`, as an `f64` so a caller can keep its fraction. */
export const pixelX = (view: View, x: f64): f64 => view.offsetX + x * view.scale

/** The pixel row of world `y`, as an `f64` so a caller can keep its fraction. */
export const pixelY = (view: View, y: f64): f64 => view.offsetY + y * view.scale

/** `v` floored to an `i32`, clamped first so neither a huge value nor NaN can overflow the conversion. */
const gfxPixel = (v: f64): i32 => {
  if (!(v > -GFX_PIXEL_LIMIT)) {
    return -1000000
  }
  if (v > GFX_PIXEL_LIMIT) {
    return 1000000
  }
  return toI32(Math.floor(v))
}

// ---- Colour and motion -----------------------------------------------------

/** `0xRRGGBB` from three channels, each clamped to 0..255. */
export const rgb = (r: i32, g: i32, b: i32): i32 => (gfxByte(r) << 16) | (gfxByte(g) << 8) | gfxByte(b)

/** `v` clamped to a channel's 0..255. */
const gfxByte = (v: i32): i32 => Math.min(Math.max(v, 0), 255)

/** The fraction `t` clamped to 0..1, NaN to 0, as the 0..256 weight the channel mixes use. */
const gfxWeight = (t: f64): i32 => {
  if (!(t > 0.0)) {
    return 0
  }
  if (t >= 1.0) {
    return 256
  }
  return toI32(t * 256.0)
}

/** Channel `a` moved toward `b` by `w` 256ths. */
const gfxMixByte = (a: i32, b: i32, w: i32): i32 => a + (((b - a) * w) >> 8)

/** `a` moved toward `b` by `t`, clamped to 0..1: 0 is `a`, 1 is `b`. */
export const mix = (a: i32, b: i32, t: f64): i32 => gfxMixWeight(a, b, gfxWeight(t))

/** `mix` with the fraction already a 0..256 weight, which the per-pixel loops compute once. */
const gfxMixWeight = (a: i32, b: i32, w: i32): i32 =>
  (gfxMixByte((a >> 16) & 255, (b >> 16) & 255, w) << 16) |
  (gfxMixByte((a >> 8) & 255, (b >> 8) & 255, w) << 8) |
  gfxMixByte(a & 255, b & 255, w)

/** `a` and `b` added channel by channel, each saturating at 255: how light adds. */
export const add = (a: i32, b: i32): i32 =>
  (Math.min(((a >> 16) & 255) + ((b >> 16) & 255), 255) << 16) |
  (Math.min(((a >> 8) & 255) + ((b >> 8) & 255), 255) << 8) |
  Math.min((a & 255) + (b & 255), 255)

/** `c` with every channel multiplied by `k`, clamped to 0..1: a dimmer copy of the same hue. */
export const dim = (c: i32, k: f64): i32 => gfxMixWeight(0, c, gfxWeight(k))

/**
 * The fully saturated colour at hue `h`, in turns: 0 is red, 1/3 green, 2/3
 * blue, and any value wraps, so a rainbow is `hue(phase + i * step)`.
 */
export const hue = (h: f64): i32 => {
  let turn: f64 = h - Math.floor(h)
  if (!(turn >= 0.0 && turn < 1.0)) {
    turn = 0.0
  }
  const h6: f64 = turn * 6.0
  const sector: i32 = toI32(Math.floor(h6))
  const rise: i32 = gfxByte(toI32((h6 - Math.floor(h6)) * 255.0))
  const fall: i32 = 255 - rise
  if (sector === 0) {
    return rgb(255, rise, 0)
  }
  if (sector === 1) {
    return rgb(fall, 255, 0)
  }
  if (sector === 2) {
    return rgb(0, 255, rise)
  }
  if (sector === 3) {
    return rgb(0, fall, 255)
  }
  if (sector === 4) {
    return rgb(rise, 0, 255)
  }
  return rgb(255, 0, fall)
}

/** `a` to `b` by `t`, not clamped: 0.5 is halfway, which is how a draw interpolates by `alpha`. */
export const lerp = (a: f64, b: f64, t: f64): f64 => a + (b - a) * t

/** `x` held to `lo..hi`; NaN becomes `lo`. */
export const clamp = (x: f64, lo: f64, hi: f64): f64 => {
  if (!(x > lo)) {
    return lo
  }
  return x > hi ? hi : x
}

/** Fast out, gentle landing: 1 - (1 - t)³ over `t` clamped to 0..1. */
export const outCubic = (t: f64): f64 => {
  const u: f64 = 1.0 - clamp(t, 0.0, 1.0)
  const cube: f64 = u * u * u
  return 1.0 - cube
}

/** Overshoots 1 by about a tenth and settles back: the pop of something arriving. */
export const outBack = (t: f64): f64 => {
  const u: f64 = clamp(t, 0.0, 1.0) - 1.0
  const u2: f64 = u * u
  return 2.70158 * u2 * u + 1.70158 * u2 + 1.0
}

/** Lands at 1 and bounces three times, each lower: a brick dropping into its wall. */
export const outBounce = (t: f64): f64 => {
  // Penner's curve with time stretched by 2.75, which turns its 7.5625 (2.75²) into 1.
  const x: f64 = clamp(t, 0.0, 1.0) * 2.75
  let u: f64 = x - 2.625
  let lift: f64 = 0.984375
  if (x < 1.0) {
    u = x
    lift = 0.0
  } else if (x < 2.0) {
    u = x - 1.5
    lift = 0.75
  } else if (x < 2.5) {
    u = x - 2.25
    lift = 0.9375
  }
  return u * u + lift
}

// ---- Shapes ----------------------------------------------------------------

/** Every pixel of the framebuffer, as a vertical gradient from `top` to `bottom`: the background. */
export const gradient = (view: View, top: i32, bottom: i32): void => {
  const fb: Framebuffer = view.fb
  const h: i32 = fb.height
  for (let y: i32 = 0; y < h; y++) {
    const colour: i32 = gfxMixWeight(top, bottom, h > 1 ? (y * 256) / (h - 1) : 0)
    gfxSpan(fb, 0, fb.width, y, colour)
  }
}

/** Paint the framebuffer outside the unshaken world with `colour`, hiding anything a shake pushed over the edge. */
export const fillLetterbox = (view: View, colour: i32): void => {
  const fb: Framebuffer = view.fb
  for (let y: i32 = 0; y < fb.height; y++) {
    if (y < view.top || y >= view.bottom) {
      gfxSpan(fb, 0, fb.width, y, colour)
    } else {
      gfxSpan(fb, 0, view.left, y, colour)
      gfxSpan(fb, view.right, fb.width, y, colour)
    }
  }
}

/** Set pixels `x0..x1` (exclusive) of row `y` to `colour`, clipped to the framebuffer. */
const gfxSpan = (fb: Framebuffer, x0: i32, x1: i32, y: i32, colour: i32): void => {
  if (y < 0 || y >= fb.height) {
    return
  }
  const from: i32 = Math.max(x0, 0)
  const to: i32 = Math.min(x1, fb.width)
  const row: i32 = y * fb.width
  const pixels: i32[] = fb.pixels
  for (let x: i32 = from; x < to; x++) {
    pixels[row + x] = colour
  }
}

/** Blend pixels `x0..x1` (exclusive) of row `y` toward `colour` by `w` 256ths, clipped. */
const gfxBlendSpan = (fb: Framebuffer, x0: i32, x1: i32, y: i32, colour: i32, w: i32): void => {
  if (y < 0 || y >= fb.height) {
    return
  }
  const from: i32 = Math.max(x0, 0)
  const to: i32 = Math.min(x1, fb.width)
  const row: i32 = y * fb.width
  const pixels: i32[] = fb.pixels
  for (let x: i32 = from; x < to; x++) {
    pixels[row + x] = gfxMixWeight(pixels[row + x], colour, w)
  }
}

/** Pixel rectangle `x0..x1` × `y0..y1` (exclusive) set to `colour`, or blended by `w` 256ths below 256. */
const gfxRect = (fb: Framebuffer, x0: i32, y0: i32, x1: i32, y1: i32, colour: i32, w: i32): void => {
  if (w <= 0) {
    return
  }
  const from: i32 = Math.max(y0, 0)
  const to: i32 = Math.min(y1, fb.height)
  for (let y: i32 = from; y < to; y++) {
    if (w >= 256) {
      gfxSpan(fb, x0, x1, y, colour)
    } else {
      gfxBlendSpan(fb, x0, x1, y, colour, w)
    }
  }
}

/** The world rectangle at `x`, `y` (its top-left) of `w` × `h`, filled with `colour`. */
export const fillRect = (view: View, x: f64, y: f64, w: f64, h: f64, colour: i32): void => {
  blendRect(view, x, y, w, h, colour, 1.0)
}

/**
 * The world rectangle blended toward `colour` by `t` (0..1): a translucent
 * panel for an overlay, or a fade or wipe over the whole world.
 */
export const blendRect = (view: View, x: f64, y: f64, w: f64, h: f64, colour: i32, t: f64): void => {
  const x0: i32 = gfxPixel(pixelX(view, x) + 0.5)
  const y0: i32 = gfxPixel(pixelY(view, y) + 0.5)
  const x1: i32 = gfxPixel(pixelX(view, x + w) + 0.5)
  const y1: i32 = gfxPixel(pixelY(view, y + h) + 0.5)
  gfxRect(view.fb, x0, y0, x1, y1, colour, gfxWeight(t))
}

/**
 * A brick: a `face` fill with a lighter top and left edge and a darker bottom
 * and right edge, so it reads as raised. The edge is about one world unit wide
 * at the view's scale and never more than a third of the brick; a brick under
 * 3 pixels either way is drawn flat, where an edge would swallow the face.
 */
export const bevelBrick = (view: View, x: f64, y: f64, w: f64, h: f64, face: i32): void => {
  const fb: Framebuffer = view.fb
  const x0: i32 = gfxPixel(pixelX(view, x) + 0.5)
  const y0: i32 = gfxPixel(pixelY(view, y) + 0.5)
  const x1: i32 = gfxPixel(pixelX(view, x + w) + 0.5)
  const y1: i32 = gfxPixel(pixelY(view, y + h) + 0.5)
  const pw: i32 = x1 - x0
  const ph: i32 = y1 - y0
  if (pw < 3 || ph < 3) {
    gfxRect(fb, x0, y0, x1, y1, face, 256)
    return
  }
  const edge: i32 = Math.max(1, Math.min(gfxPixel(view.scale + 0.5), Math.min(pw, ph) / 3))
  const light: i32 = mix(face, 0xffffff, 0.45)
  const dark: i32 = mix(face, 0x000000, 0.45)
  gfxRect(fb, x0, y0, x1, y0 + edge, light, 256)
  gfxRect(fb, x0, y0 + edge, x0 + edge, y1, light, 256)
  gfxRect(fb, x0 + edge, y1 - edge, x1, y1, dark, 256)
  gfxRect(fb, x1 - edge, y0 + edge, x1, y1 - edge, dark, 256)
  gfxRect(fb, x0 + edge, y0 + edge, x1 - edge, y1 - edge, face, 256)
}

/** A solid disc of radius `r` at `cx`, `cy`, its edge anti-aliased: a ball, a light. */
export const disc = (view: View, cx: f64, cy: f64, r: f64, colour: i32): void => {
  discAlpha(view, cx, cy, r, colour, 1.0)
}

/**
 * `disc` blended over what is there by `alpha` (0..1). Each pixel is weighed
 * by how much of it the circle covers, measured from its centre's distance to
 * the edge, so a disc a few pixels wide still looks round.
 */
export const discAlpha = (view: View, cx: f64, cy: f64, r: f64, colour: i32, alpha: f64): void => {
  const fb: Framebuffer = view.fb
  const rp: f64 = r * view.scale
  // A disc narrower than a pixel covers at most its diameter of one, so it fades out rather than stay a grey dot.
  const a: f64 = clamp(alpha, 0.0, 1.0) * clamp(rp * 2.0, 0.0, 1.0)
  if (!(rp > 0.0) || a <= 0.0) {
    return
  }
  const px: f64 = pixelX(view, cx)
  const py: f64 = pixelY(view, cy)
  const inner: f64 = rp > 0.5 ? (rp - 0.5) * (rp - 0.5) : 0.0
  const outer: f64 = (rp + 0.5) * (rp + 0.5)
  const fullW: i32 = gfxWeight(a)
  const x0: i32 = Math.max(gfxPixel(px - rp - 1.0), 0)
  const x1: i32 = Math.min(gfxPixel(px + rp + 1.0) + 1, fb.width)
  const y0: i32 = Math.max(gfxPixel(py - rp - 1.0), 0)
  const y1: i32 = Math.min(gfxPixel(py + rp + 1.0) + 1, fb.height)
  const pixels: i32[] = fb.pixels
  for (let y: i32 = y0; y < y1; y++) {
    const dy: f64 = toF64(y) + 0.5 - py
    const row: i32 = y * fb.width
    for (let x: i32 = x0; x < x1; x++) {
      const dx: f64 = toF64(x) + 0.5 - px
      const d2: f64 = dx * dx + dy * dy
      if (d2 >= outer) {
        continue
      }
      const w: i32 = d2 <= inner ? fullW : gfxWeight((rp + 0.5 - Math.sqrt(d2)) * a)
      pixels[row + x] = w >= 256 ? colour : gfxMixWeight(pixels[row + x], colour, w)
    }
  }
}

/**
 * Light added around `cx`, `cy` out to radius `r`, brightest at the centre
 * and falling off with the square of the distance: the halo a ball or an
 * explosion casts. `strength` scales it (1 adds the full colour at the centre).
 */
export const glow = (view: View, cx: f64, cy: f64, r: f64, colour: i32, strength: f64): void => {
  const fb: Framebuffer = view.fb
  const rp: f64 = r * view.scale
  if (!(rp > 0.0) || !(strength > 0.0)) {
    return
  }
  const px: f64 = pixelX(view, cx)
  const py: f64 = pixelY(view, cy)
  const r2: f64 = rp * rp
  const x0: i32 = Math.max(gfxPixel(px - rp), 0)
  const x1: i32 = Math.min(gfxPixel(px + rp) + 1, fb.width)
  const y0: i32 = Math.max(gfxPixel(py - rp), 0)
  const y1: i32 = Math.min(gfxPixel(py + rp) + 1, fb.height)
  const pixels: i32[] = fb.pixels
  for (let y: i32 = y0; y < y1; y++) {
    const dy: f64 = toF64(y) + 0.5 - py
    const row: i32 = y * fb.width
    for (let x: i32 = x0; x < x1; x++) {
      const dx: f64 = toF64(x) + 0.5 - px
      const d2: f64 = dx * dx + dy * dy
      if (d2 >= r2) {
        continue
      }
      const near: f64 = d2 / r2
      const fall: f64 = 1.0 - near
      const w: i32 = gfxWeight(fall * fall * strength)
      if (w > 0) {
        pixels[row + x] = add(pixels[row + x], gfxMixWeight(0, colour, w))
      }
    }
  }
}

/**
 * The last positions of something moving, newest last, in a ring made once:
 * what `drawTrail` draws behind a ball. `pushTrail` adds a point; a full
 * ring forgets its oldest.
 */
export class Trail {
  /** The world x of each point, in ring order. */
  xs: f64[]
  /** The world y of each point, in ring order. */
  ys: f64[]
  /** The slot the next point goes in. */
  head: i32
  /** The points held, up to the capacity. */
  count: i32

  /** A trail of up to `capacity` points, at least one. */
  constructor(capacity: i32) {
    const n: i32 = Math.max(capacity, 1)
    this.xs = new Array<f64>(n)
    this.xs.fill(0.0)
    this.ys = new Array<f64>(n)
    this.ys.fill(0.0)
    this.head = 0
    this.count = 0
  }

  /** Forget every point, as when a ball is served again. */
  clear(): void {
    this.head = 0
    this.count = 0
  }
}

/** Add the newest point to `trail`, forgetting the oldest when it is full. Call it once a step. */
export const pushTrail = (trail: Trail, x: f64, y: f64): void => {
  const n: i32 = toI32(trail.xs.length)
  if (trail.head < 0 || trail.head >= n || n !== toI32(trail.ys.length)) {
    trail.head = 0
    return
  }
  trail.xs[trail.head] = x
  trail.ys[trail.head] = y
  trail.head = trail.head + 1 >= n ? 0 : trail.head + 1
  if (trail.count < n) {
    trail.count = trail.count + 1
  }
}

/**
 * `trail` as a line of discs from oldest to newest, each larger and more
 * opaque than the one before, up to radius `r` and alpha `alpha` at the
 * newest: a streak that fades out behind what made it.
 */
export const drawTrail = (view: View, trail: Trail, r: f64, colour: i32, alpha: f64): void => {
  const n: i32 = toI32(trail.xs.length)
  const count: i32 = Math.min(trail.count, n)
  for (let i: i32 = 0; i < count; i++) {
    // The oldest point is `count` slots behind the head, wrapping.
    let slot: i32 = trail.head - count + i
    if (slot < 0) {
      slot = slot + n
    }
    if (slot < 0 || slot >= n || slot >= toI32(trail.ys.length)) {
      continue
    }
    const f: f64 = toF64(i + 1) / toF64(count + 1)
    const radius: f64 = r * (f * 0.6 + 0.4)
    discAlpha(view, trail.xs[slot], trail.ys[slot], radius, colour, alpha * f)
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
const FONT: string =
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

/** The bits of row `row` of the glyph for byte `c`; a byte outside 32..126 draws as `?`. */
const glyphRow = (c: i32, row: i32): i32 => {
  const g: i32 = c >= 32 && c <= 126 ? c - 32 : 31
  const at: i32 = g * GLYPH_H + row
  if (row < 0 || row >= GLYPH_H || at < 0 || at >= toI32(FONT.length)) {
    return 0
  }
  return toI32(FONT.charCodeAt(at)) - 48
}

/** The width in framebuffer pixels of `text` at integer `scale`: 6 font pixels a glyph, less the last gap. */
export const textWidth = (text: string, scale: i32): i32 => {
  const n: i32 = toI32(text.length)
  if (n === 0 || scale < 1) {
    return 0
  }
  return (n * GLYPH_ADVANCE - 1) * Math.min(scale, GFX_MAX_TEXT_SCALE)
}

/**
 * The largest integer font scale whose glyphs fit in `worldHeight` world
 * units at the view's scale, or 0 when even scale 1 (7 pixels) does not: the
 * signal for a compact layout.
 */
export const fontScaleFor = (view: View, worldHeight: f64): i32 => {
  const s: i32 = gfxPixel((worldHeight * view.scale) / toF64(GLYPH_H))
  return Math.max(s, 0)
}

/**
 * `text` with its top-left at world `x`, `y`, each font pixel a `scale` ×
 * `scale` block of framebuffer pixels in `colour`. Text is pixel art, so it is
 * placed on whole pixels and never blended; a scale under 1 draws nothing.
 */
export const drawText = (view: View, x: f64, y: f64, scale: i32, text: string, colour: i32): void => {
  gfxText(view.fb, gfxPixel(pixelX(view, x) + 0.5), gfxPixel(pixelY(view, y) + 0.5), scale, text, colour)
}

/** `drawText` over a copy in `shadow` one font pixel down and to the right, which keeps it legible on anything. */
export const drawTextShadow = (
  view: View,
  x: f64,
  y: f64,
  scale: i32,
  text: string,
  colour: i32,
  shadow: i32
): void => {
  const px: i32 = gfxPixel(pixelX(view, x) + 0.5)
  const py: i32 = gfxPixel(pixelY(view, y) + 0.5)
  const drop: i32 = Math.min(scale, GFX_MAX_TEXT_SCALE)
  gfxText(view.fb, px + drop, py + drop, scale, text, shadow)
  gfxText(view.fb, px, py, scale, text, colour)
}

/** `text` centred on world `cx` with its top at `y`, over a shadow unless `shadow` is `NO_SHADOW`. */
export const drawTextCentred = (
  view: View,
  cx: f64,
  y: f64,
  scale: i32,
  text: string,
  colour: i32,
  shadow: i32
): void => {
  const px: i32 = gfxPixel(pixelX(view, cx) + 0.5) - textWidth(text, scale) / 2
  const py: i32 = gfxPixel(pixelY(view, y) + 0.5)
  if (shadow !== NO_SHADOW) {
    const drop: i32 = Math.min(scale, GFX_MAX_TEXT_SCALE)
    gfxText(view.fb, px + drop, py + drop, scale, text, shadow)
  }
  gfxText(view.fb, px, py, scale, text, colour)
}

/** `text` with its top-left at pixel `x`, `y`, at integer `scale`, clipped to the framebuffer. */
const gfxText = (fb: Framebuffer, x: i32, y: i32, size: i32, text: string, colour: i32): void => {
  if (size < 1) {
    return
  }
  const scale: i32 = Math.min(size, GFX_MAX_TEXT_SCALE)
  const n: i32 = toI32(text.length)
  let gx: i32 = x
  for (let i: i32 = 0; i < n && gx < fb.width; i++) {
    const c: i32 = toI32(text.charCodeAt(i))
    if (gx + GLYPH_W * scale > 0) {
      for (let row: i32 = 0; row < GLYPH_H; row++) {
        const bits: i32 = glyphRow(c, row)
        const top: i32 = y + row * scale
        for (let col: i32 = 0; col < GLYPH_W; col++) {
          if (((bits >> (GLYPH_W - 1 - col)) & 1) !== 0) {
            const left: i32 = gx + col * scale
            gfxRect(fb, left, top, left + scale, top + scale, colour, 256)
          }
        }
      }
    }
    gx = gx + GLYPH_ADVANCE * scale
  }
}

// ---- Particles -------------------------------------------------------------

/**
 * A fixed pool of particles: sparks from a broken brick, debris from an
 * explosion, fireworks. Each particle's position, previous position,
 * velocity, colour, size and life sit in parallel arrays made once, so
 * spawning, stepping and drawing allocate nothing. Slots are reused in spawn
 * order, so when every slot is live a new particle replaces the oldest.
 */
export class Particles {
  /** World x now. */
  xs: f64[]
  /** World y now. */
  ys: f64[]
  /** World x a step ago, which a draw interpolates from. */
  prevXs: f64[]
  /** World y a step ago. */
  prevYs: f64[]
  /** World units a second across. */
  vxs: f64[]
  /** World units a second down. */
  vys: f64[]
  /** Seconds of life left; a particle at or under 0 is dead. */
  lives: f64[]
  /** The seconds of life each particle was spawned with, which its fade is measured against. */
  spans: f64[]
  /** The side of each particle's square in world units. */
  sizes: f64[]
  /** Each particle's colour. */
  colours: i32[]
  /** The slot the next spawn takes: the oldest. */
  next: i32

  /** A pool of `capacity` dead particles, at least one. */
  constructor(capacity: i32) {
    const n: i32 = Math.max(capacity, 1)
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

  /** How many particles the pool holds at once. */
  capacity(): i32 {
    return toI32(this.lives.length)
  }

  /** How many particles are alive. */
  live(): i32 {
    let n: i32 = 0
    for (const life of this.lives) {
      if (life > 0.0) {
        n++
      }
    }
    return n
  }

  /** Kill every particle, as a new level starts. */
  clear(): void {
    this.lives.fill(0.0)
    this.next = 0
  }

  /** Whether `i` is a slot of every one of the parallel arrays, which the pool keeps the same length. */
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
 * A particle at world `x`, `y` moving at `vx`, `vy` world units a second,
 * living `life` seconds, a square `size` units wide in `colour`. It takes the
 * pool's oldest slot, live or not, so a full pool replaces its oldest particle.
 */
export const spawnParticle = (
  pool: Particles,
  x: f64,
  y: f64,
  vx: f64,
  vy: f64,
  life: f64,
  size: f64,
  colour: i32
): void => {
  const i: i32 = pool.next
  if (!pool.has(i)) {
    pool.next = 0
    return
  }
  pool.xs[i] = x
  pool.ys[i] = y
  pool.prevXs[i] = x
  pool.prevYs[i] = y
  pool.vxs[i] = vx
  pool.vys[i] = vy
  pool.lives[i] = life > 0.0 ? life : 0.0
  pool.spans[i] = life > 0.0 ? life : 1.0
  pool.sizes[i] = size
  pool.colours[i] = colour
  pool.next = i + 1 >= pool.capacity() ? 0 : i + 1
}

/**
 * One simulation step (1 / `STEPS_PER_SECOND` seconds) of `pool`: every live
 * particle falls under `gravity` (world units a second squared), loses `drag`
 * of its speed a second, moves and ages.
 */
export const stepParticles = (pool: Particles, gravity: f64, drag: f64): void => {
  const dt: f64 = 1.0 / toF64(STEPS_PER_SECOND)
  const lost: f64 = drag * dt
  const keep: f64 = clamp(1.0 - lost, 0.0, 1.0)
  for (let i: i32 = 0; i < pool.capacity(); i++) {
    if (!pool.has(i) || pool.lives[i] <= 0.0) {
      continue
    }
    pool.prevXs[i] = pool.xs[i]
    pool.prevYs[i] = pool.ys[i]
    pool.vxs[i] = pool.vxs[i] * keep
    pool.vys[i] = (pool.vys[i] + gravity * dt) * keep
    pool.xs[i] = pool.xs[i] + pool.vxs[i] * dt
    pool.ys[i] = pool.ys[i] + pool.vys[i] * dt
    pool.lives[i] = pool.lives[i] - dt
  }
}

/**
 * Every live particle of `pool` at its position `alpha` of the way from the
 * last step to this one, faded by the life it has left.
 */
export const drawParticles = (view: View, pool: Particles, alpha: f64): void => {
  for (let i: i32 = 0; i < pool.capacity(); i++) {
    if (!pool.has(i) || pool.lives[i] <= 0.0) {
      continue
    }
    const half: f64 = pool.sizes[i] / 2.0
    const x: f64 = lerp(pool.prevXs[i], pool.xs[i], alpha) - half
    const y: f64 = lerp(pool.prevYs[i], pool.ys[i], alpha) - half
    blendRect(view, x, y, pool.sizes[i], pool.sizes[i], pool.colours[i], pool.lives[i] / pool.spans[i])
  }
}
