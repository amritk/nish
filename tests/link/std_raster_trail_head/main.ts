// `rasterTrail` with a `head` a caller set outside the ring: the points
// `count` slots behind it that land in the ring are drawn, as for an in-range
// head, and the others are not. Four points sit at x = 0, 3, 6 and 9 on row
// 4, in slots 0 to 3. A head of 6 counts back to slots 2, 3, 4 and 5, so x = 6
// and 9 are drawn; a head of -2 wraps to slots -2, -1, 0 and 1, so x = 0 and
// 3 are. A head no slot can reach from draws nothing and never panics.
import { RasterTrail, rasterPushTrail, rasterTrail } from "nish/raster"
import { Suite } from "nish/testing"

const W: i32 = 16
const H: i32 = 8
const FRAME = new Int32Array(16 * 8)

const ZERO: f64 = 0.0
const ONE: f64 = 1.0
const ROW: f64 = 4.0
const RADIUS: f64 = 2.0

/** Every pixel of `FRAME` set to 0. */
const clear = (): void => {
  for (let i: i32 = 0; i < W * H; i++) {
    FRAME[i] = 0
  }
}

/** How many pixels of `FRAME` are not 0. */
const changed = (): i32 => {
  let n: i32 = 0
  for (let i: i32 = 0; i < W * H; i++) {
    if (FRAME[i] !== 0) {
      n++
    }
  }
  return n
}

/** Whether the pixel at `x` on the points' row is drawn. */
const lit = (x: i32): boolean => FRAME[4 * W + x] !== 0

/** The trail drawn into a cleared frame. */
const draw = (trail: RasterTrail): void => {
  clear()
  rasterTrail(FRAME, W, H, trail, RADIUS, 0xffffff, ONE, ONE, ZERO, ZERO)
}

export const main = (): i32 => {
  const t = new Suite("raster trail head")
  const trail = new RasterTrail(4)
  for (let i: i32 = 0; i < 4; i++) {
    rasterPushTrail(trail, toF64(i * 3), ROW)
  }
  t.eqI32("a full ring wraps its head to slot 0", trail.head, 0)
  draw(trail)
  t.ok("an in-range head draws every point", lit(0) && lit(3) && lit(6) && lit(9))

  trail.head = 6
  draw(trail)
  t.ok("head past the ring: slots 2 and 3 land in it and are drawn", lit(6) && lit(9))
  t.ok("head past the ring: slots 4 and 5 do not, so x 0 and 3 stay clear", !lit(0) && !lit(3))

  trail.head = -2
  draw(trail)
  t.ok("head below the ring: slots 0 and 1 land in it and are drawn", lit(0) && lit(3))
  t.ok("head below the ring: x 6 and 9 stay clear", !lit(6) && !lit(9))

  trail.head = 1000
  draw(trail)
  t.eqI32("a head no slot reaches from draws nothing", changed(), 0)
  trail.head = -2147483647
  draw(trail)
  t.eqI32("the lowest head draws nothing and does not overflow", changed(), 0)
  trail.head = 2147483647
  draw(trail)
  t.eqI32("the highest head draws nothing and does not overflow", changed(), 0)
  return t.done()
}
