// `nish/term-pixels`: resizing a framebuffer to a negative size panics.
import { Framebuffer } from "nish/term-pixels"

export const main = (): i32 => {
  const fb = new Framebuffer(2, 2)
  fb.resize(3, 1)
  console.log(`${fb.pixels.length}`)
  fb.resize(-1, 1)
  console.log(`${fb.pixels.length}`)
  return 0
}
