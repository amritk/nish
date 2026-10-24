// `nish/term-pixels`: scaling by a divisor below 1 panics.
import { Framebuffer, scaleFramebuffer } from "nish/term-pixels"

export const main = (): i32 => {
  const src = new Framebuffer(5, 3)
  const dst = new Framebuffer(0, 0)
  scaleFramebuffer(src, 2147483647, dst)
  console.log(`${dst.width}x${dst.height}`)
  scaleFramebuffer(src, 0, dst)
  console.log(`${dst.width}x${dst.height}`)
  return 0
}
