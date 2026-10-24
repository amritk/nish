// `nish/term-pixels`: a framebuffer of negative size panics.
import { Framebuffer } from "nish/term-pixels"

export const main = (): i32 => {
  console.log(`${new Framebuffer(2, 3).pixels.length}`)
  console.log(`${new Framebuffer(2, -3).pixels.length}`)
  return 0
}
