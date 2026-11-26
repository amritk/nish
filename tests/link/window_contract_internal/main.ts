// A guard and a forwarding method no host can name (docs/LANGUAGE.md, "Panic
// sites"): neither is exported, so both are `internal` and only the calls in
// this module reach them. The one call into `Sink.write` proves its window, so
// `Sink.write` lists its call into `checkWindow` as proven and `checkWindow`
// lists its own `panic` as proven: each call into it is the site
// (`expected.panics`). `window_contract_host_called` exports the same pair.
// `done.ts` is only the cross-module call every linked case makes.
import { done } from "./done"

const checkWindow = (what: string, buf: readonly u8[], off: i32, len: i32): void => {
  const size: i32 = toI32(buf.length)
  if (off < 0 || len < 0 || off > size || len > size - off) {
    panic(`${what}: the window is outside the buffer`)
  }
}

class Sink {
  total: i32
  constructor() {
    this.total = 0
  }
  write(buf: readonly u8[], off: i32, len: i32): i32 {
    checkWindow("Sink.write", buf, off, len)
    this.total = len
    return len
  }
}

export const main = (): void => {
  const buf: u8[] = [1, 2, 3, 4]
  const sink = new Sink()
  console.log(`${sink.write(buf, 0, toI32(buf.length))}`)
  console.log(done())
}
