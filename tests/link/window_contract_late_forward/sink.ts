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
    this.total = len
    checkWindow("Sink.write", buf, off, len)
    return len
  }
}
