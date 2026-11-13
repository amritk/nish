// The drawing kit behind `nish break`, the brick breaker hidden in the CLI.
// The menu and the game both draw through it, so it holds everything they
// share and nothing either owns: the fixed world and the view that maps it onto
// a framebuffer, easing arithmetic, and the world-coordinate shapes. The pixel
// work underneath (colour, rectangles, discs, glows, the font, the particle
// and trail pools) is `nish/raster`'s; this module only turns world units into
// pixels and adds what is the game's own, the bevelled brick and the letterbox.
//
// Simulation lives in a 320×180 world measured in `f64` units that knows
// nothing of pixels; a `View` maps it onto whatever `Framebuffer` the terminal
// backend hands over, from a tiny half-block canvas to a 960×540 kitty image.
// Every shape takes world coordinates, goes through the view and is clipped to
// the framebuffer, so a resize never touches game state. The raster draws
// straight into the framebuffer's `pixels`, so nothing is copied.
//
// Nothing here allocates after construction, because a collection pause in a
// game stepping 120 times a second is a dropped frame.

import { Framebuffer } from "nish/term-pixels"
import {
  RASTER_GLYPH_H,
  RASTER_MAX_TEXT_SCALE,
  RASTER_SOLID,
  RasterParticles,
  RasterTrail,
  rasterDisc,
  rasterFrame,
  rasterGlow,
  rasterGradient,
  rasterMix,
  rasterParticles,
  rasterPixel,
  rasterRect,
  rasterStepParticles,
  rasterText,
  rasterTextWidth,
  rasterTrail,
  rasterWeight,
} from "../std/raster"

/** Simulation steps a second: every duration the game and menu count is in these steps. */
export const STEPS_PER_SECOND: i32 = 120

/** The world's width in world units. */
export const WORLD_W: f64 = 320.0

/** The world's height in world units: 16:9 with `WORLD_W`. */
export const WORLD_H: f64 = 180.0

/** The shadow colour that means "no shadow" to `drawTextCentred`. */
export const NO_SHADOW: i32 = -1

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
  view.left = rasterPixel(baseX)
  view.top = rasterPixel(baseY)
  view.right = rasterPixel(baseX + WORLD_W * scale + 0.5)
  view.bottom = rasterPixel(baseY + WORLD_H * scale + 0.5)
}

/** The pixel column of world `x`, as an `f64` so a caller can keep its fraction. */
export const pixelX = (view: View, x: f64): f64 => view.offsetX + x * view.scale

/** The pixel row of world `y`, as an `f64` so a caller can keep its fraction. */
export const pixelY = (view: View, y: f64): f64 => view.offsetY + y * view.scale

// ---- Motion ----------------------------------------------------------------

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
  rasterGradient(rasterFrame(fb.pixels), fb.width, fb.height, top, bottom)
}

/** Paint the framebuffer outside the unshaken world with `colour`, hiding anything a shake pushed over the edge. */
export const fillLetterbox = (view: View, colour: i32): void => {
  const fb: Framebuffer = view.fb
  rasterRect(rasterFrame(fb.pixels), fb.width, fb.height, 0, 0, fb.width, view.top, colour, RASTER_SOLID)
  rasterRect(rasterFrame(fb.pixels), fb.width, fb.height, 0, view.bottom, fb.width, fb.height, colour, RASTER_SOLID)
  rasterRect(rasterFrame(fb.pixels), fb.width, fb.height, 0, view.top, view.left, view.bottom, colour, RASTER_SOLID)
  rasterRect(rasterFrame(fb.pixels), fb.width, fb.height, view.right, view.top, fb.width, view.bottom, colour, RASTER_SOLID)
}

/** The pixel rectangle `x0..x1` × `y0..y1` (exclusive) filled with `colour`. */
const solidRect = (fb: Framebuffer, x0: i32, y0: i32, x1: i32, y1: i32, colour: i32): void => {
  rasterRect(rasterFrame(fb.pixels), fb.width, fb.height, x0, y0, x1, y1, colour, RASTER_SOLID)
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
  const fb: Framebuffer = view.fb
  const x0: i32 = rasterPixel(pixelX(view, x) + 0.5)
  const y0: i32 = rasterPixel(pixelY(view, y) + 0.5)
  const x1: i32 = rasterPixel(pixelX(view, x + w) + 0.5)
  const y1: i32 = rasterPixel(pixelY(view, y + h) + 0.5)
  rasterRect(rasterFrame(fb.pixels), fb.width, fb.height, x0, y0, x1, y1, colour, rasterWeight(t))
}

/**
 * A brick: a `face` fill with a lighter top and left edge and a darker bottom
 * and right edge, so it reads as raised. The edge is about one world unit wide
 * at the view's scale and never more than a third of the brick; a brick under
 * 3 pixels either way is drawn flat, where an edge would swallow the face.
 */
export const bevelBrick = (view: View, x: f64, y: f64, w: f64, h: f64, face: i32): void => {
  const fb: Framebuffer = view.fb
  const x0: i32 = rasterPixel(pixelX(view, x) + 0.5)
  const y0: i32 = rasterPixel(pixelY(view, y) + 0.5)
  const x1: i32 = rasterPixel(pixelX(view, x + w) + 0.5)
  const y1: i32 = rasterPixel(pixelY(view, y + h) + 0.5)
  const pw: i32 = x1 - x0
  const ph: i32 = y1 - y0
  if (pw < 3 || ph < 3) {
    solidRect(fb, x0, y0, x1, y1, face)
    return
  }
  const edge: i32 = Math.max(1, Math.min(rasterPixel(view.scale + 0.5), Math.min(pw, ph) / 3))
  const light: i32 = rasterMix(face, 0xffffff, 0.45)
  const dark: i32 = rasterMix(face, 0x000000, 0.45)
  solidRect(fb, x0, y0, x1, y0 + edge, light)
  solidRect(fb, x0, y0 + edge, x0 + edge, y1, light)
  solidRect(fb, x0 + edge, y1 - edge, x1, y1, dark)
  solidRect(fb, x1 - edge, y0 + edge, x1, y1 - edge, dark)
  solidRect(fb, x0 + edge, y0 + edge, x1 - edge, y1 - edge, face)
}

/** A solid disc of radius `r` at `cx`, `cy`, its edge anti-aliased: a ball, a light. */
export const disc = (view: View, cx: f64, cy: f64, r: f64, colour: i32): void => {
  discAlpha(view, cx, cy, r, colour, 1.0)
}

/** `disc` blended over what is there by `alpha` (0..1). */
export const discAlpha = (view: View, cx: f64, cy: f64, r: f64, colour: i32, alpha: f64): void => {
  const fb: Framebuffer = view.fb
  rasterDisc(rasterFrame(fb.pixels), fb.width, fb.height, pixelX(view, cx), pixelY(view, cy), r * view.scale, colour, alpha)
}

/**
 * Light added around `cx`, `cy` out to radius `r`, brightest at the centre:
 * the halo a ball or an explosion casts. `strength` scales it (1 adds the full
 * colour at the centre).
 */
export const glow = (view: View, cx: f64, cy: f64, r: f64, colour: i32, strength: f64): void => {
  const fb: Framebuffer = view.fb
  rasterGlow(rasterFrame(fb.pixels), fb.width, fb.height, pixelX(view, cx), pixelY(view, cy), r * view.scale, colour, strength)
}

/**
 * `trail` (in world units) as a line of discs from oldest to newest, up to
 * radius `r` and alpha `alpha` at the newest: a streak behind a ball.
 */
export const drawTrail = (view: View, trail: RasterTrail, r: f64, colour: i32, alpha: f64): void => {
  const fb: Framebuffer = view.fb
  rasterTrail(rasterFrame(fb.pixels), fb.width, fb.height, trail, r, colour, alpha, view.scale, view.offsetX, view.offsetY)
}

// ---- Text ------------------------------------------------------------------

/**
 * The largest integer font scale whose glyphs fit in `worldHeight` world
 * units at the view's scale, or 0 when even scale 1 (7 pixels) does not: the
 * signal for a compact layout.
 */
export const fontScaleFor = (view: View, worldHeight: f64): i32 => {
  const s: i32 = rasterPixel((worldHeight * view.scale) / toF64(RASTER_GLYPH_H))
  return Math.max(s, 0)
}

/**
 * `text` with its top-left at world `x`, `y`, each font pixel a `scale` ×
 * `scale` block of framebuffer pixels in `colour`. Text is pixel art, so it is
 * placed on whole pixels and never blended; a scale under 1 draws nothing.
 */
export const drawText = (view: View, x: f64, y: f64, scale: i32, text: string, colour: i32): void => {
  const fb: Framebuffer = view.fb
  const px: i32 = rasterPixel(pixelX(view, x) + 0.5)
  const py: i32 = rasterPixel(pixelY(view, y) + 0.5)
  rasterText(rasterFrame(fb.pixels), fb.width, fb.height, px, py, scale, text, colour)
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
  const fb: Framebuffer = view.fb
  const px: i32 = rasterPixel(pixelX(view, x) + 0.5)
  const py: i32 = rasterPixel(pixelY(view, y) + 0.5)
  const drop: i32 = Math.min(scale, RASTER_MAX_TEXT_SCALE)
  rasterText(rasterFrame(fb.pixels), fb.width, fb.height, px + drop, py + drop, scale, text, shadow)
  rasterText(rasterFrame(fb.pixels), fb.width, fb.height, px, py, scale, text, colour)
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
  const fb: Framebuffer = view.fb
  const px: i32 = rasterPixel(pixelX(view, cx) + 0.5) - rasterTextWidth(text, scale) / 2
  const py: i32 = rasterPixel(pixelY(view, y) + 0.5)
  if (shadow !== NO_SHADOW) {
    const drop: i32 = Math.min(scale, RASTER_MAX_TEXT_SCALE)
    rasterText(rasterFrame(fb.pixels), fb.width, fb.height, px + drop, py + drop, scale, text, shadow)
  }
  rasterText(rasterFrame(fb.pixels), fb.width, fb.height, px, py, scale, text, colour)
}

// ---- Particles -------------------------------------------------------------

/**
 * One simulation step (1 / `STEPS_PER_SECOND` seconds) of `pool`: every live
 * particle falls under `gravity` (world units a second squared), loses `drag`
 * of its speed a second, moves and ages.
 */
export const stepParticles = (pool: RasterParticles, gravity: f64, drag: f64): void => {
  rasterStepParticles(pool, 1.0 / toF64(STEPS_PER_SECOND), gravity, drag)
}

/**
 * Every live particle of `pool` (in world units) at its position `alpha` of
 * the way from the last step to this one, faded by the life it has left.
 */
export const drawParticles = (view: View, pool: RasterParticles, alpha: f64): void => {
  const fb: Framebuffer = view.fb
  rasterParticles(rasterFrame(fb.pixels), fb.width, fb.height, pool, alpha, view.scale, view.offsetX, view.offsetY)
}
