// `nish/net/url`: urlQueryStart over a window that starts before the array. A
// caller's bug, so a panic: exit 1 and `urlQueryStart: the window is outside
// the array` on stderr, natively and under Node.
import { urlQueryStart } from "nish/net/url"

export const main = (): i32 => {
  const src: u8[] = new Array<u8>(4)
  urlQueryStart(src, -1, 2)
  console.log("unreachable: the call was accepted")
  return 0
}
