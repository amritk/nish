// A generic caller of a window forward (docs/LANGUAGE.md, "Panic sites"). The
// contracts are noted before any instance is made, but an instance's body is
// still checked against them: `feed`'s instance passes `Sink.write` a window
// nothing proves, so under `--deny-panics` the call is refused as it would be
// in a function with no type parameter. Behind
// `if (off >= 0 && off <= end && end <= buf.length)` with `end - off` it
// compiles.
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

const feed = <T>(tag: T, s: Sink, buf: u8[], off: i32, len: i32): T => {
  s.write(buf, off, len)
  return tag
}

export const main = (): void => {
  const buf: u8[] = [1, 2, 3, 4]
  const sink = new Sink()
  console.log(`${feed(7, sink, buf, 1, 5)}`)
}
