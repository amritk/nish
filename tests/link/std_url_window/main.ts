// `nish/net/url`: a window that reaches past its array. That is the caller's
// bug, not anything a peer sent, and the one thing the module panics on: exit
// 1, the panic's message, and nothing on stdout after the line before it.
import { UrlQuery, UrlQueryLimits } from "nish/net/url"

export const main = (): i32 => {
  const src: u8[] = new Array<u8>(4)
  const q: UrlQuery = new UrlQuery(new UrlQueryLimits())
  console.log("a window of 5 bytes over 4")
  q.reset(src, 0, 5)
  console.log("unreachable: the window was accepted")
  return 0
}
