// `nish/term-pixels`: a kitty image id below 1 panics; kitty reserves 0.
import { Framebuffer, PixelBytes, PixelRect, kittyDelete, kittyFrame } from "nish/term-pixels"

export const main = (): i32 => {
  const fb = new Framebuffer(1, 1)
  const rect = new PixelRect(0, 0, 1, 1, 1, 1, 1.0)
  const out = new PixelBytes(0)
  kittyFrame(fb, rect, 1, out)
  console.log(`${kittyDelete(1).length > 0 ? 1 : 0}`)
  kittyFrame(fb, rect, 0, out)
  return 0
}
