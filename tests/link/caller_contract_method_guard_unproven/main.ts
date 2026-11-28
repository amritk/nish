// `caller_contract_method_guard` with the product left out of the caller's
// guard: `fit` tests only the signs before `f.resize(w, h)`, so nothing
// proves `toI64(w) * toI64(h) <= 2147483647` there, the call is not proven,
// and `pixelsArea`'s `panic`s stay its own: `--deny-panics` refuses them
// (docs/LANGUAGE.md, "Panic sites").
import { done } from "./done"

const pixelsArea = (who: string, width: i32, height: i32): i32 => {
  if (width < 0 || height < 0) {
    panic(`${who}: a negative size`)
  }
  const size: i64 = toI64(width) * toI64(height)
  if (size > toI64(2147483647)) {
    panic(`${who}: more than 2^31 - 1 pixels`)
  }
  return toI32(size)
}

class Frame {
  cells: i32

  constructor(width: i32, height: i32) {
    const cells: i32 = pixelsArea("Frame", width, height)
    this.cells = cells
  }

  resize(width: i32, height: i32): void {
    const cells: i32 = pixelsArea("Frame.resize", width, height)
    this.cells = cells
  }
}

const fit = (f: Frame, w: i32, h: i32): i32 => {
  if (w < 0 || h < 0) {
    return -1
  }
  f.resize(w, h)
  return f.cells
}

export const main = (): i32 => {
  const f = new Frame(2, 3)
  console.log(`${f.cells} ${fit(f, 640, 480)} ${fit(f, -1, 4)} ${fit(f, 65536, 65536)} ${fit(f, 46340, 46340)}`)
  console.log(done())
  return 0
}
