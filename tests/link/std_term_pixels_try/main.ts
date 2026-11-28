// `nish/term-pixels`: `tryFramebuffer` and `Framebuffer.tryResize` answer an
// `Err` for each size the constructor and `resize` panic on (a negative side,
// more than 2^31 - 1 pixels) and size the buffer as they do otherwise. A
// refused `tryResize` leaves the framebuffer as it was. `--allow-panics`:
// `tryFramebuffer` builds through the constructor, whose size checks a call
// still reaches.
import { Framebuffer, tryFramebuffer } from "nish/term-pixels"

/** The size and length of `fb`, as `w×h/len`. */
const shape = (fb: Framebuffer): string => `${fb.pixelWidth()}×${fb.pixelHeight()}/${fb.pixelData().length}`

/** What `tryFramebuffer(w, h)` answers, as its shape or its error. */
const made = (w: i32, h: i32): string => {
  const r: Result<Framebuffer, string> = tryFramebuffer(w, h)
  if (r.isErr()) {
    return `err ${r.error}`
  }
  return `ok ${shape(r.value)}`
}

export const main = (): i32 => {
  console.log(made(3, 2))
  console.log(made(0, 5))
  console.log(made(-1, 2))
  console.log(made(2, -1))
  console.log(made(65536, 65536))
  const fb = new Framebuffer(2, 2)
  fb.set(1, 1, 0xff0000)
  const same: Result<void, string> = fb.tryResize(2, 2)
  console.log(`same ${same.isOk()} ${shape(fb)} ${fb.get(1, 1)}`)
  const grown: Result<void, string> = fb.tryResize(4, 3)
  console.log(`grown ${grown.isOk()} ${shape(fb)}`)
  fb.set(3, 2, 0x00ff00)
  const negative: Result<void, string> = fb.tryResize(-3, 1)
  console.log(`negative ${negative.isErr() ? negative.error : "ok"} ${shape(fb)} ${fb.get(3, 2)}`)
  const huge: Result<void, string> = fb.tryResize(46341, 46341)
  console.log(`huge ${huge.isErr() ? huge.error : "ok"} ${shape(fb)} ${fb.get(3, 2)}`)
  return 0
}
