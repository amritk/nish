// The drawing kit behind the brick breaker (`src/break-gfx.ts`), pinned pixel by
// pixel: the view that maps the 320×180 world onto a framebuffer, every shape,
// the font, the colour and easing arithmetic, and the two pools. The negatives
// are the framebuffers too small to draw in and a pool spawned past its
// capacity, which must clamp and never panic.
import { Suite } from "../../../std/testing"
import { Framebuffer } from "../../../std/term-pixels"
import {
  GLYPH_ADVANCE,
  GLYPH_H,
  GLYPH_W,
  NO_SHADOW,
  Particles,
  STEPS_PER_SECOND,
  Trail,
  View,
  WORLD_H,
  WORLD_W,
  add,
  bevelBrick,
  blendRect,
  clamp,
  dim,
  disc,
  discAlpha,
  drawParticles,
  drawText,
  drawTextCentred,
  drawTextShadow,
  drawTrail,
  fillLetterbox,
  fillRect,
  fontScaleFor,
  glow,
  gradient,
  hue,
  lerp,
  mix,
  outBack,
  outBounce,
  outCubic,
  pixelX,
  pixelY,
  pushTrail,
  rgb,
  spawnParticle,
  stepParticles,
  textWidth,
  viewFor,
} from "../../../src/break-gfx"

/** A view of a fresh black `w` × `h` framebuffer, unshaken. */
const viewOf = (w: i32, h: i32): View => {
  const view = new View()
  viewFor(view, new Framebuffer(w, h), 0.0, 0.0)
  return view
}

/** `t.eqF64`, as a function so its literal arguments are typed `f64` by the parameters. */
const eqF = (t: Suite, name: string, actual: f64, expected: f64): boolean => t.eqF64(name, actual, expected)

/** `t.nearF64`, as a function for the same reason. */
const nearF = (t: Suite, name: string, actual: f64, expected: f64, tolerance: f64): boolean =>
  t.nearF64(name, actual, expected, tolerance)

/** How many pixels of `fb` are not black. */
const lit = (fb: Framebuffer): i32 => {
  let n: i32 = 0
  for (const p of fb.pixels) {
    if (p !== 0) {
      n++
    }
  }
  return n
}

const testView = (t: Suite): void => {
  t.eqI32("STEPS_PER_SECOND", STEPS_PER_SECOND, 120)
  eqF(t, "WORLD_W", WORLD_W, 320.0)
  eqF(t, "WORLD_H", WORLD_H, 180.0)

  const small = viewOf(80, 45)
  eqF(t, "80x45: a quarter pixel a unit", small.scale, 0.25)
  eqF(t, "80x45: no letterbox", small.offsetX + small.offsetY, 0.0)
  t.eqI32("80x45: the world fills it", small.right * 1000 + small.bottom, 80045)

  const native = viewOf(320, 180)
  eqF(t, "320x180: a pixel a unit", native.scale, 1.0)
  eqF(t, "320x180: world 200 is pixel 200", pixelX(native, 200.0), 200.0)

  const big = viewOf(960, 540)
  eqF(t, "960x540: three pixels a unit", big.scale, 3.0)
  eqF(t, "960x540: world 10, 20 is pixel 30, 60", pixelX(big, 10.0) * 1000.0 + pixelY(big, 20.0), 30060.0)

  // A wider framebuffer is letterboxed left and right, the world centred.
  const wide = viewOf(100, 45)
  eqF(t, "100x45: the height decides the scale", wide.scale, 0.25)
  t.eqI32("100x45: centred", wide.left * 1000 + wide.right, 10090)
  eqF(t, "100x45: the origin is past the bar", wide.offsetX, 10.0)

  // Shake is in world units, so it moves three pixels a unit at 960x540, and
  // leaves the letterbox rectangle where it was.
  const shaken = new View()
  viewFor(shaken, new Framebuffer(960, 540), 2.0, -1.0)
  eqF(t, "shake x in world units", shaken.offsetX, 6.0)
  eqF(t, "shake y in world units", shaken.offsetY, -3.0)
  eqF(t, "the shake is kept", shaken.shakeX * 10.0 + shaken.shakeY, 19.0)
  t.eqI32("shake leaves the world rectangle", shaken.left + shaken.top, 0)

  // Negatives: nothing to draw in, and nothing panics.
  const empty = viewOf(0, 0)
  eqF(t, "0x0: scale 0", empty.scale, 0.0)
  fillRect(empty, 0.0, 0.0, WORLD_W, WORLD_H, 0xffffff)
  bevelBrick(empty, 0.0, 0.0, 30.0, 10.0, 0x808080)
  disc(empty, 160.0, 90.0, 50.0, 0xffffff)
  glow(empty, 160.0, 90.0, 50.0, 0xffffff, 1.0)
  drawText(empty, 0.0, 0.0, 3, "EMPTY", 0xffffff)
  gradient(empty, 0x000000, 0xffffff)
  fillLetterbox(empty, 0x222222)
  t.eqI32("0x0: font scale 0", fontScaleFor(empty, 50.0), 0)
  t.eqI32("0x0: drew nothing", empty.fb.pixels.length, 0)

  const dot = viewOf(1, 1)
  disc(dot, 160.0, 90.0, 1.0, 0xffffff)
  t.eqI32("1x1: a disc far under a pixel fades out", dot.fb.get(0, 0), 0)
  drawText(dot, 0.0, 0.0, 1, "X", 0xffffff)
  t.eqI32("1x1: text is placed on whole pixels", dot.fb.get(0, 0), 0xffffff)
  fillRect(dot, 0.0, 0.0, WORLD_W, WORLD_H, 0x123456)
  t.eqI32("1x1: the whole world is its one pixel", dot.fb.get(0, 0), 0x123456)
}

const testColour = (t: Suite): void => {
  t.eqI32("rgb", rgb(0x12, 0x34, 0x56), 0x123456)
  t.eqI32("rgb clamps each channel", rgb(300, -5, 16), 0xff0010)
  t.eqI32("mix at 0", mix(0x102030, 0xffffff, 0.0), 0x102030)
  t.eqI32("mix at 1", mix(0x102030, 0xffffff, 1.0), 0xffffff)
  t.eqI32("mix halfway", mix(0x000000, 0xffffff, 0.5), 0x7f7f7f)
  t.eqI32("mix clamps t", mix(0x000000, 0xffffff, 7.0), 0xffffff)
  t.eqI32("add", add(0x010203, 0x020304), 0x030507)
  t.eqI32("add saturates", add(0x808080, 0x90ff01), 0xffff81)
  t.eqI32("dim", dim(0xff8040, 0.5), 0x7f4020)
  t.eqI32("hue 0 is red", hue(0.0), 0xff0000)
  t.eqI32("hue 1/3 is green", hue(toF64(1) / toF64(3)), 0x00ff00)
  t.eqI32("hue 2/3 is blue", hue(toF64(2) / toF64(3)), 0x0000ff)
  t.eqI32("hue 1/12 is orange", hue(toF64(1) / toF64(12)), 0xff7f00)
  t.eqI32("hue wraps", hue(-1.0), 0xff0000)
  eqF(t, "lerp", lerp(2.0, 6.0, 0.25), 3.0)
  eqF(t, "lerp is not clamped", lerp(0.0, 10.0, 1.5), 15.0)
  eqF(t, "clamp low", clamp(-3.0, 0.0, 1.0), 0.0)
  eqF(t, "clamp high", clamp(3.0, 0.0, 1.0), 1.0)
  eqF(t, "clamp inside", clamp(0.5, 0.0, 1.0), 0.5)
}

const testEasing = (t: Suite): void => {
  eqF(t, "outCubic(0)", outCubic(0.0), 0.0)
  eqF(t, "outCubic(1)", outCubic(1.0), 1.0)
  eqF(t, "outCubic(0.5)", outCubic(0.5), 0.875)
  nearF(t, "outBack(0)", outBack(0.0), 0.0, 0.000000001)
  eqF(t, "outBack(1)", outBack(1.0), 1.0)
  t.ok("outBack overshoots", outBack(0.7) > 1.05)
  eqF(t, "outBounce(0)", outBounce(0.0), 0.0)
  eqF(t, "outBounce(1)", outBounce(1.0), 1.0)
  eqF(t, "outBounce lands first at 1/2.75", outBounce(toF64(1) / 2.75), 1.0)
  t.ok("outBounce dips after landing", outBounce(0.55) < 0.8)
  eqF(t, "easing clamps t below", outCubic(-2.0) + outBounce(-2.0), 0.0)
  eqF(t, "easing clamps t above", outBack(4.0), 1.0)
}

const testShapes = (t: Suite): void => {
  const v = viewOf(320, 180)
  const fb = v.fb

  // A disc's edge pixels are weighed by coverage: the centre pixel is the
  // colour, one whose centre is on the rim is half of it, one past is untouched.
  disc(v, 10.5, 10.5, 2.0, 0xffffff)
  t.eqI32("disc: the centre is solid", fb.get(10, 10), 0xffffff)
  t.eqI32("disc: a pixel on the rim is half covered", fb.get(12, 10), 0x7f7f7f)
  t.eqI32("disc: a pixel past the rim is untouched", fb.get(13, 10), 0)
  t.eqI32("disc: 21 pixels at least partly", lit(fb), 21)
  fb.clear()

  discAlpha(v, 50.5, 50.5, 3.0, 0xffffff, 0.5)
  t.eqI32("discAlpha: the centre at half", fb.get(50, 50), 0x7f7f7f)
  discAlpha(v, 50.5, 50.5, 3.0, 0xffffff, 0.0)
  t.eqI32("discAlpha at 0 adds nothing", fb.get(50, 50), 0x7f7f7f)
  fb.clear()

  // Glow adds light falling off with the square of the distance.
  fb.set(101, 100, 0x0000ff)
  glow(v, 100.5, 100.5, 4.0, 0xff0000, 1.0)
  t.eqI32("glow: full at the centre", fb.get(100, 100), 0xff0000)
  t.eqI32("glow: adds to what is there", fb.get(101, 100), 0xe000ff)
  t.eqI32("glow: (1 - 4/16)² at distance 2", fb.get(102, 100), 0x8f0000)
  t.eqI32("glow: nothing at the radius", fb.get(104, 100), 0)
  fb.clear()

  fillRect(v, 10.0, 20.0, 5.0, 3.0, 0x00ff00)
  t.eqI32("fillRect: 15 pixels", lit(fb), 15)
  t.eqI32("fillRect: its corner", fb.get(14, 22), 0x00ff00)
  t.eqI32("fillRect: right edge exclusive", fb.get(15, 22), 0)
  blendRect(v, 10.0, 20.0, 1.0, 1.0, 0x000000, 0.5)
  t.eqI32("blendRect: halfway to black", fb.get(10, 20), 0x007f00)
  fb.clear()

  // A brick: light top-left edge, dark bottom-right edge, face inside.
  bevelBrick(v, 10.0, 10.0, 20.0, 10.0, 0x808080)
  t.eqI32("bevelBrick: top-left edge is lighter", fb.get(10, 10), 0xb9b9b9)
  t.eqI32("bevelBrick: bottom-right edge is darker", fb.get(29, 19), 0x464646)
  t.eqI32("bevelBrick: the face", fb.get(20, 15), 0x808080)
  t.eqI32("bevelBrick: covers its rectangle", lit(fb), 200)
  fb.clear()
  const big = viewOf(960, 540)
  bevelBrick(big, 10.0, 10.0, 20.0, 10.0, 0x808080)
  t.eqI32("bevelBrick: the edge scales with the view", big.fb.get(32, 32), 0xb9b9b9)
  t.eqI32("bevelBrick: and stops after it", big.fb.get(33, 33), 0x808080)
  // At 80x45 the brick is 5 by 2 pixels: too small for an edge.
  const small = viewOf(80, 45)
  bevelBrick(small, 10.0, 10.0, 20.0, 8.0, 0x808080)
  t.eqI32("bevelBrick: flat under 3 pixels", small.fb.get(3, 3) + small.fb.get(7, 4), 0x808080 * 2)

  // Clipping: shapes hanging off every edge draw what is inside and no more.
  fillRect(v, -50.0, -50.0, 500.0, 300.0, 0x010101)
  disc(v, -1.0, -1.0, 4.0, 0x020202)
  disc(v, 321.0, 181.0, 4.0, 0x020202)
  glow(v, 319.0, 0.0, 30.0, 0x404040, 2.0)
  bevelBrick(v, 300.0, 170.0, 40.0, 20.0, 0x808080)
  drawText(v, 310.0, 175.0, 3, "CLIP", 0xffffff)
  drawText(v, -20.0, -3.0, 2, "CLIP", 0xffffff)
  drawTextShadow(v, 0.0, 0.0, 2147483647, "HUGE", 0xffffff, 0)
  drawTextCentred(v, 0.0, 0.0, 2147483647, "HUGE", 0xffffff, 0)
  t.eqI32("clipped shapes cover the framebuffer", lit(fb), 320 * 180)
  fb.clear()

  gradient(v, 0x000000, 0xff0000)
  t.eqI32("gradient: the top row", fb.get(5, 0), 0x000000)
  t.eqI32("gradient: the bottom row", fb.get(5, 179), 0xff0000)
  t.ok("gradient: in between", fb.get(5, 90) > 0x700000 && fb.get(5, 90) < 0x900000)

  const wide = viewOf(100, 45)
  fillLetterbox(wide, 0x222222)
  t.eqI32("fillLetterbox: the left bar", wide.fb.get(0, 20), 0x222222)
  t.eqI32("fillLetterbox: the world", wide.fb.get(10, 20) + wide.fb.get(89, 20), 0)
  t.eqI32("fillLetterbox: the right bar", wide.fb.get(90, 20), 0x222222)
  t.eqI32("fillLetterbox: only the bars", lit(wide.fb), 20 * 45)
}

const testText = (t: Suite): void => {
  t.eqI32("GLYPH_W", GLYPH_W, 5)
  t.eqI32("GLYPH_H", GLYPH_H, 7)
  t.eqI32("GLYPH_ADVANCE", GLYPH_ADVANCE, 6)
  t.eqI32("textWidth of one glyph", textWidth("A", 3), 15)
  t.eqI32("textWidth drops the last gap", textWidth("AB", 1), 11)
  t.eqI32("textWidth of nothing", textWidth("", 2), 0)
  t.eqI32("textWidth at scale 0", textWidth("AB", 0), 0)
  t.eqI32("textWidth caps the scale", textWidth("A", 2147483647), 5 * 1024)
  t.eqI32("fontScaleFor at 960x540", fontScaleFor(viewOf(960, 540), 10.0), 4)
  t.eqI32("fontScaleFor at 320x180", fontScaleFor(viewOf(320, 180), 10.0), 1)
  t.eqI32("fontScaleFor: nothing fits at 80x45", fontScaleFor(viewOf(80, 45), 10.0), 0)

  // `A` is .###. over #...# and a crossbar on its fourth row.
  const v = viewOf(320, 180)
  const fb = v.fb
  drawText(v, 0.0, 0.0, 1, "A", 0xffffff)
  t.eqI32("glyph A: the top-left corner is clear", fb.get(0, 0), 0)
  t.eqI32("glyph A: its apex", fb.get(1, 0) & fb.get(2, 0) & fb.get(3, 0), 0xffffff)
  t.eqI32("glyph A: its sides", fb.get(0, 1) & fb.get(4, 6), 0xffffff)
  t.eqI32("glyph A: its counter", fb.get(2, 1) | fb.get(2, 4), 0)
  t.eqI32("glyph A: its crossbar", fb.get(1, 3) & fb.get(3, 3), 0xffffff)
  t.eqI32("glyph A: 18 pixels", lit(fb), 18)
  fb.clear()

  drawText(v, 0.0, 0.0, 2, "A", 0xffffff)
  t.eqI32("glyph A at scale 2: four pixels each", lit(fb), 72)
  fb.clear()

  drawText(v, 0.0, 0.0, 1, "\u{1}", 0xffffff)
  const unknown: i32 = lit(fb)
  fb.clear()
  drawText(v, 0.0, 0.0, 1, "?", 0xffffff)
  t.eqI32("an unknown byte draws as ?", unknown, lit(fb))
  t.ok("? draws something", unknown > 0)
  fb.clear()

  drawText(v, 0.0, 0.0, 1, " ", 0xffffff)
  drawText(v, 0.0, 0.0, 0, "A", 0xffffff)
  t.eqI32("a space, and scale 0, draw nothing", lit(fb), 0)

  drawTextShadow(v, 0.0, 0.0, 1, "A", 0xffffff, 0x333333)
  t.eqI32("drawTextShadow: the glyph", fb.get(1, 0), 0xffffff)
  t.eqI32("drawTextShadow: the shadow below its apex", fb.get(2, 1), 0x333333)
  fb.clear()

  drawTextCentred(v, 160.0, 0.0, 1, "A", 0xffffff, 0x333333)
  t.eqI32("drawTextCentred: centred on 160", fb.get(159, 0), 0xffffff)
  t.eqI32("drawTextCentred: with its shadow", fb.get(160, 1), 0x333333)
  fb.clear()
  drawTextCentred(v, 160.0, 0.0, 1, "A", 0xffffff, NO_SHADOW)
  t.eqI32("drawTextCentred: NO_SHADOW", lit(fb), 18)
}

const testPools = (t: Suite): void => {
  const v = viewOf(320, 180)
  const fb = v.fb

  const p = new Particles(4)
  t.eqI32("a new pool is dead", p.live(), 0)
  for (let i: i32 = 0; i < 6; i++) {
    spawnParticle(p, toF64(i), 0.0, 0.0, 0.0, 1.0, 1.0, 0xffffff)
  }
  t.eqI32("the pool caps at its capacity", p.live(), 4)
  t.eqI32("its capacity", p.capacity(), 4)
  eqF(t, "the oldest slot is reused first", p.xs[0] * 10.0 + p.xs[1], 45.0)
  eqF(t, "the rest keep the next oldest", p.xs[2] * 10.0 + p.xs[3], 23.0)
  t.ok("an index past the pool is no slot", !p.has(4) && !p.has(-1) && p.has(3))

  const none = new Particles(0)
  spawnParticle(none, 1.0, 1.0, 0.0, 0.0, 1.0, 1.0, 0xffffff)
  spawnParticle(none, 2.0, 1.0, 0.0, 0.0, 1.0, 1.0, 0xffffff)
  t.eqI32("capacity 0 is clamped to 1", none.capacity() * 10 + none.live(), 11)
  spawnParticle(none, 1.0, 1.0, 0.0, 0.0, -1.0, 1.0, 0xffffff)
  t.eqI32("a particle spawned with no life is dead", none.live(), 0)

  // One step moves a particle a 120th of its velocity, gravity first.
  const q = new Particles(2)
  spawnParticle(q, 10.0, 10.0, 120.0, 0.0, 1.0, 2.0, 0xff0000)
  stepParticles(q, 120.0, 0.0)
  eqF(t, "step moves by velocity / STEPS_PER_SECOND", q.xs[0], 11.0)
  nearF(t, "step applies gravity", q.vys[0], 1.0, 0.000000001)
  eqF(t, "step remembers where it was", q.prevXs[0], 10.0)
  stepParticles(q, 0.0, 60.0)
  eqF(t, "drag takes its share a step", q.vxs[0], 60.0)

  // Drawn halfway between the last step and this one, faded by life left.
  drawParticles(v, q, 0.0)
  t.ok("drawn at the previous position", fb.get(10, 9) !== 0)
  fb.clear()
  spawnParticle(q, 100.0, 100.0, 0.0, 0.0, 1.0, 2.0, 0x00ff00)
  drawParticles(v, q, 1.0)
  t.eqI32("a new particle draws at full colour", fb.get(100, 100), 0x00ff00)
  fb.clear()

  for (let i: i32 = 0; i < STEPS_PER_SECOND + 1; i++) {
    stepParticles(q, 0.0, 0.0)
  }
  t.eqI32("a particle dies when its life runs out", q.live(), 0)
  drawParticles(v, q, 1.0)
  t.eqI32("a dead particle draws nothing", lit(fb), 0)
  p.clear()
  t.eqI32("clear kills them all", p.live(), 0)

  const trail = new Trail(3)
  for (let i: i32 = 0; i < 5; i++) {
    pushTrail(trail, toF64(100 + i * 10), 50.0)
  }
  t.eqI32("a trail keeps its capacity", trail.count, 3)
  drawTrail(v, trail, 2.0, 0xffffff, 1.0)
  t.eqI32("the oldest points are forgotten", fb.get(100, 50) + fb.get(110, 50), 0)
  t.ok("the newest point is the brightest", fb.get(140, 50) > fb.get(120, 50) && fb.get(120, 50) > 0)
  fb.clear()
  trail.clear()
  drawTrail(v, trail, 2.0, 0xffffff, 1.0)
  t.eqI32("a cleared trail draws nothing", lit(fb) + trail.count, 0)
  const one = new Trail(0)
  pushTrail(one, 5.0, 5.0)
  pushTrail(one, 6.0, 5.0)
  t.eqI32("a trail of capacity 0 is clamped to 1", one.count, 1)
}

export const main = (): number => {
  const t = new Suite("break-gfx")
  testView(t)
  testColour(t)
  testEasing(t)
  testShapes(t)
  testText(t)
  testPools(t)
  return t.done()
}
