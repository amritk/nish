// A guard and a forwarding method a host can call (docs/LANGUAGE.md, "Panic
// sites"): both are exported from the root package, so each is an external
// symbol a C host calls with any window. The call in `main` proves its window,
// yet the host's calls hold no test, so `checkWindow`'s `panic` and the call
// `Sink.write` makes into it stay unproven and `--deny-panics` (`args`)
// refuses both. `window_contract_internal` keeps the same pair internal.
export const checkWindow = (what: string, buf: readonly u8[], off: i32, len: i32): void => {
  const size: i32 = toI32(buf.length)
  if (off < 0 || len < 0 || off > size || len > size - off) {
    panic(`${what}: the window is outside the buffer`)
  }
}

export class Sink {
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
}
