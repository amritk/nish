// `nish/net/url`: percentDecode over a window of negative length, which only
// the `len < 0` test of the window guard refuses. A caller's bug, so a panic:
// exit 1 and `percentDecode: the window is outside the array` on stderr,
// natively and under Node.
import { percentDecode } from "nish/net/url"

export const main = (): i32 => {
  const src: u8[] = new Array<u8>(4)
  const out: u8[] = new Array<u8>(4)
  percentDecode(src, 0, -1, out, 0, 0)
  console.log("unreachable: the call was accepted")
  return 0
}
