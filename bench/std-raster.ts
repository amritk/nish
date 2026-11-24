// The software rasteriser (std/raster.ts) under an instruction count: frames
// drawn into `GAME_FRAME` (std/host/game.ts) at the size a browser game sets,
// as examples/game-starter draws them. Each frame fills the background with
// `rasterGradient`, blends rectangles, discs and glows over it, blits text
// with `rasterText` (measured with `rasterTextWidth`), pushes to and draws a
// `RasterTrail`, and spawns, steps and draws a `RasterParticles` pool, every
// shape partly off the frame's edge on some frames so the clipping runs too.
// A fix to a panic site the std/ ratchet counts in those functions shows here
// as a count that holds or falls. It prints a checksum of the frames' pixels.
import { GAME_FRAME, gameHeight, gameSetSize, gameWidth } from "nish/host/game"
import {
  RASTER_SOLID,
  RasterParticles,
  RasterTrail,
  rasterDisc,
  rasterGlow,
  rasterGradient,
  rasterParticles,
  rasterPushTrail,
  rasterRect,
  rasterSpawnParticle,
  rasterStepParticles,
  rasterText,
  rasterTextWidth,
  rasterTrail,
} from "nish/raster"

/** game-starter's frame. */
const WIDTH: i32 = 320
const HEIGHT: i32 = 180
/** One step of a 60 Hz game, in seconds. */
const STEP_S: f64 = 1.0 / 60.0

/** A position that sweeps `0 .. span` and back, a little past each end, on frame `k`. */
const sweep = (k: i32, speed: i32, span: i32): f64 => {
  const period: i32 = span * 2 + 40
  const t: i32 = (k * speed) % period
  const p: i32 = t < span + 20 ? t : period - t
  return toF64(p - 10)
}

/** The sum of every 7th pixel of the frame, folded so that it cannot overflow. */
const checksum = (pixels: Int32Array, cells: i32): i64 => {
  let sum: i64 = 0
  for (let i: i32 = 0; i < cells && i < toI32(pixels.length); i += 7) {
    sum = (sum * 31 + toI64(pixels[i] & 0xffffff)) % 1000000007
  }
  return sum
}

export const main = (): i32 => {
  const n: i32 = 400 // bench:n
  gameSetSize(WIDTH, HEIGHT)
  const w: i32 = gameWidth()
  const h: i32 = gameHeight()
  const trail = new RasterTrail(24)
  const pool = new RasterParticles(96)
  let sum: i64 = 0
  for (let k: i32 = 0; k < n; k++) {
    rasterGradient(GAME_FRAME, w, h, 0x101830, 0x302040)
    const x: f64 = sweep(k, 3, w)
    const y: f64 = sweep(k, 2, h)
    rasterRect(GAME_FRAME, w, h, toI32(x) - 24, 160, toI32(x) + 24, 168, 0xe0e0f0, RASTER_SOLID)
    rasterRect(GAME_FRAME, w, h, -8, toI32(y) - 6, 60, toI32(y) + 6, 0x40c0ff, 96)
    rasterDisc(GAME_FRAME, w, h, x, y, 4.0, 0xffd040, 1.0)
    rasterDisc(GAME_FRAME, w, h, toF64(w) - x, y, 11.5, 0x80ff80, 0.6)
    rasterGlow(GAME_FRAME, w, h, x, y, 18.0, 0xffa040, 0.8)
    rasterPushTrail(trail, x, y)
    rasterTrail(GAME_FRAME, w, h, trail, 3.0, 0xffd040, 0.5, 1.0, 0.0, 0.0)
    if (k % 2 === 0) {
      const a: f64 = toF64(k % 16) * 0.39
      rasterSpawnParticle(pool, x, y, Math.cos(a) * 60.0, Math.sin(a) * 60.0 - 40.0, 1.2, 2.0, 0xff8040)
    }
    rasterStepParticles(pool, STEP_S, 120.0, 0.5)
    rasterParticles(GAME_FRAME, w, h, pool, 0.9, 1.0, 0.0, 0.0)
    const score: string = `SCORE ${k}`
    const right: i32 = toI32(toF64(w) - toF64(rasterTextWidth(score, 1)) - 6.0)
    rasterText(GAME_FRAME, w, h, right, 6, 1, score, 0xa0a0c0)
    const hint: string = "PRESS SPACE TO SERVE"
    const centre: i32 = toI32((toF64(w) - toF64(rasterTextWidth(hint, 2))) / 2.0)
    rasterText(GAME_FRAME, w, h, centre + toI32(x) - 160, 90, 2, hint, 0xf0f0f0)
    sum = (sum + checksum(GAME_FRAME, w * h)) % 1000000007
  }
  console.log(`${sum}`)
  return 0
}
