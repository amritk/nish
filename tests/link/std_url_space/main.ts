// `nish/net/url`: an output buffer one byte too small. The decoder answers
// URL_DECODE_ERR_SPACE at the byte with no room, writes nothing past the
// buffer, and the program answers the refusal as its exit code.
import { URL_DECODE_ERR_SPACE, percentDecode, percentDecodeErrorAt } from "nish/net/url"

export const main = (): i32 => {
  const src: u8[] = [toU8(97), toU8(37), toU8(52), toU8(49), toU8(98)]
  const out: u8[] = new Array<u8>(2)
  const n: i32 = percentDecode(src, 0, 5, out, 0, 0)
  const at: i32 = percentDecodeErrorAt(src, 0, 5, out, 0, 0)
  console.log("decoded " + `${n}` + " at " + `${at}` + " wrote " + `${toI32(out[0])}` + " " + `${toI32(out[1])}`)
  if (n === URL_DECODE_ERR_SPACE) {
    return 1
  }
  console.log("unreachable: three bytes fit in two")
  return 0
}
