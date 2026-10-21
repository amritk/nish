// `nish/net/url`: percentDecode writing from an `at` past the end of `out`. A
// caller's bug, so a panic: exit 1 and `percentDecode: at is outside out` on
// stderr, natively and under Node.
import { percentDecode } from "nish/net/url"

export const main = (): i32 => {
  const src: u8[] = new Array<u8>(4)
  const out: u8[] = new Array<u8>(4)
  percentDecode(src, 0, 4, out, 5, 0)
  console.log("unreachable: the call was accepted")
  return 0
}
