// `nish/raster`: the colour helpers' exact arithmetic, each shape drawn into
// module storage (as a wasm module's frame is) and read back pixel by pixel,
// every shape clipped at the frame's edges, and a frame too short for its
// size drawing only the rows it has. A shape off the frame, a radius of 0,
// a scale under 1 and a NaN must all draw nothing and never panic.
import {
  RASTER_GLYPH_ADVANCE,
  RASTER_SOLID,
  RasterParticles,
  RasterTrail,
  rasterAdd,
  rasterDim,
  rasterDisc,
  rasterFrame,
  rasterGlow,
  rasterGradient,
  rasterHue,
  rasterMix,
  rasterParticles,
  rasterPixel,
  rasterPushTrail,
  rasterRect,
  rasterRgb,
  rasterSpawnParticle,
  rasterStepParticles,
  rasterText,
  rasterTextWidth,
  rasterTrail,
  rasterWeight,
} from "nish/raster"
import { Suite } from "nish/testing"

const W: i32 = 16
const H: i32 = 8
const FRAME = new Int32Array(16 * 8)
const SHORT = new Int32Array(16 * 2)

const ZERO: f64 = 0.0
const HALF: f64 = 0.5
const ONE: f64 = 1.0

/** Every pixel of `FRAME` set to `c`. */
const clear = (c: i32): void => {
  for (let i: i32 = 0; i < W * H; i++) {
    FRAME[i] = c
  }
}

/** How many pixels of `FRAME` are not `c`. */
const changed = (c: i32): i32 => {
  let n: i32 = 0
  for (let i: i32 = 0; i < W * H; i++) {
    if (FRAME[i] !== c) {
      n++
    }
  }
  return n
}

export const main = (): number => {
  const t = new Suite("raster")

  t.eqI32("rgb: packs", rasterRgb(0x12, 0x34, 0x56), 0x123456)
  t.eqI32("rgb: clamps each channel", rasterRgb(300, -5, 255), 0xff00ff)
  t.eqI32("weight: 0", rasterWeight(ZERO), 0)
  t.eqI32("weight: a half", rasterWeight(HALF), 128)
  t.eqI32("weight: past 1 is solid", rasterWeight(ONE * 3.0), RASTER_SOLID)
  t.eqI32("weight: NaN is 0", rasterWeight(ZERO / ZERO), 0)
  t.eqI32("mix: halfway", rasterMix(0x000000, 0xfe0080, HALF), 0x7f0040)
  t.eqI32("mix: all the way", rasterMix(0x102030, 0xffffff, ONE), 0xffffff)
  t.eqI32("add: saturates", rasterAdd(0xf08010, 0x20ff01), 0xffff11)
  t.eqI32("dim: half", rasterDim(0x8040fe, HALF), 0x40207f)
  t.eqI32("hue: 0 is red", rasterHue(ZERO), 0xff0000)
  t.eqI32("hue: a whole turn is red again", rasterHue(ONE), 0xff0000)
  t.eqI32("hue: NaN is red", rasterHue(ZERO / ZERO), 0xff0000)
  t.eqI32("pixel: rounds down", rasterPixel(ONE * 2.75), 2)
  t.eqI32("pixel: negative rounds down", rasterPixel(-HALF), -1)

  clear(0)
  rasterGradient(FRAME, W, H, 0x000000, 0x0000ff)
  t.eqI32("gradient: the first row is the top", FRAME[0], 0x000000)
  t.eqI32("gradient: the last row is the bottom", FRAME[(H - 1) * W + 5], 0x0000ff)
  t.ok("gradient: a middle row between", FRAME[4 * W] > 0 && FRAME[4 * W] < 0xff)

  clear(0)
  rasterRect(FRAME, W, H, -4, -4, 2, 2, 0xffffff, RASTER_SOLID)
  t.eqI32("rect: clipped at the top left", changed(0), 4)
  rasterRect(FRAME, W, H, 14, 6, 99, 99, 0xffffff, RASTER_SOLID)
  t.eqI32("rect: clipped at the bottom right", changed(0), 8)
  rasterRect(FRAME, W, H, 40, 40, 50, 50, 0xffffff, RASTER_SOLID)
  rasterRect(FRAME, W, H, 4, 4, 6, 6, 0xffffff, 0)
  t.eqI32("rect: off the frame or weightless draws nothing", changed(0), 8)
  rasterRect(FRAME, W, H, 0, 0, 1, 1, 0x000000, 128)
  t.eqI32("rect: a half weight blends", FRAME[0], 0x7f7f7f)

  clear(0)
  rasterDisc(FRAME, W, H, ONE * 8.0, ONE * 4.0, ONE * 3.0, 0xff0000, ONE)
  t.eqI32("disc: the centre is the colour", FRAME[4 * W + 8], 0xff0000)
  t.eqI32("disc: a corner is untouched", FRAME[0], 0)
  t.ok("disc: an edge pixel is blended", FRAME[4 * W + 5] > 0 && FRAME[4 * W + 5] < 0xff0000)
  const lit: i32 = changed(0)
  rasterDisc(FRAME, W, H, ONE * 8.0, ONE * 4.0, ZERO, 0xffffff, ONE)
  rasterDisc(FRAME, W, H, ONE * 8.0, ONE * 4.0, ZERO / ZERO, 0xffffff, ONE)
  rasterDisc(FRAME, W, H, ONE * 999.0, ONE * 4.0, ONE * 3.0, 0xffffff, ONE)
  t.eqI32("disc: radius 0, NaN or off the frame draws nothing", changed(0), lit)

  clear(0x101010)
  rasterGlow(FRAME, W, H, ONE * 8.0, ONE * 4.0, ONE * 4.0, 0x204080, ONE)
  const red: i32 = (FRAME[4 * W + 8] >> 16) & 255
  t.ok("glow: the centre adds nearly the full red", red > 0x28 && red <= 0x30)
  t.eqI32("glow: past the radius adds nothing", FRAME[0], 0x101010)

  t.eqI32("text width: one glyph", rasterTextWidth("A", 1), 5)
  t.eqI32("text width: two at scale 2", rasterTextWidth("AB", 2), (2 * RASTER_GLYPH_ADVANCE - 1) * 2)
  t.eqI32("text width: empty", rasterTextWidth("", 3), 0)
  t.eqI32("text width: scale 0", rasterTextWidth("A", 0), 0)
  clear(0)
  rasterText(FRAME, W, H, 0, 0, 1, "I", 0xffffff)
  const strokes: i32 = changed(0)
  t.ok("text: a glyph lights some pixels", strokes > 0 && strokes < 5 * 7)
  rasterText(FRAME, W, H, 0, 0, 0, "I", 0x00ff00)
  rasterText(FRAME, W, H, 99, 0, 1, "I", 0x00ff00)
  t.eqI32("text: scale 0 or off the frame draws nothing", changed(0), strokes)
  clear(0)
  rasterText(FRAME, W, H, 0, 0, 1, "é", 0xffffff)
  const unknown: i32 = changed(0)
  clear(0)
  rasterText(FRAME, W, H, 0, 0, 1, "??", 0xffffff)
  t.eqI32("text: outside ASCII draws as ?, one a UTF-8 byte", changed(0), unknown)

  clear(0)
  const trail = new RasterTrail(3)
  for (let i: i32 = 0; i < 5; i++) {
    rasterPushTrail(trail, toF64(i * 3), ONE * 4.0)
  }
  t.eqI32("trail: holds its capacity", trail.count, 3)
  rasterTrail(FRAME, W, H, trail, ONE, 0xffffff, ONE, ONE, ZERO, ZERO)
  t.eqI32("trail: the oldest forgotten point is not drawn", FRAME[4 * W], 0)
  t.ok("trail: the newest point is drawn", FRAME[4 * W + 12] !== 0)

  clear(0)
  const pool = new RasterParticles(2)
  rasterSpawnParticle(pool, ONE * 4.0, ONE * 4.0, ONE * 10.0, ZERO, ONE, ONE * 2.0, 0x00ff00)
  rasterStepParticles(pool, HALF, ZERO, ZERO)
  t.eqF64("particles: moved by velocity × dt", pool.xs[0], ONE * 9.0)
  rasterParticles(FRAME, W, H, pool, ONE, ONE, ZERO, ZERO)
  t.ok("particles: a live particle draws", changed(0) > 0)
  clear(0)
  rasterStepParticles(pool, ONE, ZERO, ZERO)
  rasterParticles(FRAME, W, H, pool, ONE, ONE, ZERO, ZERO)
  t.eqI32("particles: a dead particle draws nothing", changed(0), 0)

  rasterRect(SHORT, W, H, 0, 0, W, H, 0xffffff, RASTER_SOLID)
  t.eqI32("short frame: its last word is drawn", SHORT[2 * W - 1], 0xffffff)
  rasterDisc(SHORT, W, H, ONE * 8.0, ONE * 6.0, ONE * 4.0, 0xff0000, ONE)
  rasterText(SHORT, W, H, 0, 0, 2, "W", 0xff0000)
  t.pass("short frame: rows past its length are never written")

  const grid: i32[] = new Array<i32>(W * H)
  grid.fill(0)
  rasterRect(rasterFrame(grid), W, H, 1, 1, 2, 2, 0xabcdef, RASTER_SOLID)
  t.eqI32("frame: an i32[] is drawn in place", grid[W + 1], 0xabcdef)
  return t.done()
}
