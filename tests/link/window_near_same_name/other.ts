// A second window guard named `checkWindow`, which `sink.ts` imports under another name.
export const checkWindow = (what: string, buf: readonly u8[], off: i32, len: i32): void => {
  const size: i32 = toI32(buf.length)
  if (off < 0 || len < 0 || off > size || len > size - off) {
    panic(`${what}: the other window is outside the buffer`)
  }
}
