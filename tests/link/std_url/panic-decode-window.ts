// `nish/net/url`: percentDecode over a window of 5 bytes in a 4-byte array. A
// caller's bug, so a panic: exit 1 and `percentDecode: the window is outside
// the array` on stderr, natively and under Node.
import { percentDecode } from "nish/net/url"

export const main = (): i32 => {
  const src: u8[] = new Array<u8>(4)
  const out: u8[] = new Array<u8>(8)
  percentDecode(src, 0, 5, out, 0, 0)
  console.log("unreachable: the call was accepted")
  return 0
}
