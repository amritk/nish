// A free function and an arrow `const` that forward their window, both
// exported so a host can call them (docs/LANGUAGE.md, "Panic sites"). The
// guard is internal, and its only callers are the two forwarders, so its own
// `panic` is proven. But each forwarder is an external symbol a C host calls
// with any window, and the host's calls hold no test, so each forwarder's call
// into `checkWindow` stays unproven, however well `main` proves its own calls,
// and `--deny-panics` (`args`) refuses both. `window_contract_host_called` is
// the same refusal for an exported guard and a forwarding method.
const checkWindow = (what: string, buf: readonly u8[], off: i32, len: i32): void => {
  const size: i32 = toI32(buf.length)
  if (off < 0 || len < 0 || off > size || len > size - off) {
    panic(`${what}: the window is outside the buffer`)
  }
}

export function total(buf: readonly u8[], off: i32, len: i32): i32 {
  checkWindow("total", buf, off, len)
  return len
}

export const readU16 = (b: readonly u8[], off: i32): i32 => {
  checkWindow("readU16", b, off, 2)
  return toI32(b[off]) | (toI32(b[off + 1]) << 8)
}

export const main = (): void => {
  const buf: u8[] = [1, 2, 3, 4]
  console.log(`${total(buf, 0, toI32(buf.length))}`)
  if (2 <= buf.length) {
    console.log(`${readU16(buf, 0)}`)
  }
}
