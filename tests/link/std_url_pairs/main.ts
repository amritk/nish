// `nish/net/url`: a query of more pairs than the cap. The iterator yields
// exactly maxPairs of them, then URL_QUERY_ERR_PAIRS, and stays spent; the
// program answers the refusal as its exit code.
import { URL_QUERY_ERR_PAIRS, URL_QUERY_PAIR, UrlQuery, UrlQueryLimits } from "nish/net/url"

export const main = (): i32 => {
  const n: i32 = 1000
  const src: u8[] = new Array<u8>(n * 2)
  let i: i32 = 0
  while (i < n) {
    src[i * 2] = toU8(97)
    src[i * 2 + 1] = toU8(38)
    i += 1
  }
  const q: UrlQuery = new UrlQuery(new UrlQueryLimits())
  q.reset(src, 0, n * 2)
  let pairs: i32 = 0
  let k: i32 = q.next()
  while (k === URL_QUERY_PAIR) {
    pairs += 1
    k = q.next()
  }
  console.log("pairs " + `${pairs}` + " then " + `${k}` + " again " + `${q.next()}`)
  if (k === URL_QUERY_ERR_PAIRS && q.failed === URL_QUERY_ERR_PAIRS) {
    return 1
  }
  console.log("unreachable: the cap did not hold")
  return 0
}
