// `nish/term-pixels`: a framebuffer whose public `width` was set out of step
// with `pixels` panics on a read past `pixels`, rather than reading black.
import { Framebuffer } from "nish/term-pixels"

export const main = (): i32 => {
  const fb = new Framebuffer(2, 2)
  console.log(`${fb.get(1, 1)}`)
  fb.width = 3
  console.log(`${fb.get(2, 1)}`)
  return 0
}
