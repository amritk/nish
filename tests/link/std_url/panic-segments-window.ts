// `nish/net/url`: UrlPathSegments reset to a window of 5 bytes in a 4-byte
// array. A caller's bug, so a panic: exit 1 and `UrlPathSegments: the window is
// outside the array` on stderr, natively and under Node.
import { UrlPathSegments } from "nish/net/url"

export const main = (): i32 => {
  const src: u8[] = new Array<u8>(4)
  const path: UrlPathSegments = new UrlPathSegments()
  path.reset(src, 0, 5)
  console.log("unreachable: the call was accepted")
  return 0
}
