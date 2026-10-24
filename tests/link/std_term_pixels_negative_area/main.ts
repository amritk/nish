// `nish/term-pixels`: a framebuffer of more pixels than an array holds panics
// rather than wrapping its area to a small array.
import { Framebuffer } from "nish/term-pixels"

export const main = (): i32 => {
  const fb = new Framebuffer(0, 65536)
  console.log(`${fb.pixels.length}`)
  fb.resize(65536, 65536)
  console.log(`${fb.pixels.length}`)
  return 0
}
