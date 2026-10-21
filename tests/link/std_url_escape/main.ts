// `nish/net/url`: a malformed escape in a value, as a handler meets it. Strict
// decoding refuses it with URL_DECODE_ERR_ESCAPE at the `%`, and the program
// answers the refusal as its exit code, as a server answers 400.
import { URL_DECODE_ERR_ESCAPE, URL_DECODE_FORM, percentDecode, percentDecodeErrorAt } from "nish/net/url"

export const main = (): i32 => {
  const src: u8[] = [toU8(110), toU8(61), toU8(37), toU8(122), toU8(122)]
  const out: u8[] = new Array<u8>(5)
  const n: i32 = percentDecode(src, 2, 3, out, 0, URL_DECODE_FORM)
  console.log("decoded " + `${n}` + " at " + `${percentDecodeErrorAt(src, 2, 3, out, 0, URL_DECODE_FORM)}`)
  if (n === URL_DECODE_ERR_ESCAPE) {
    return 1
  }
  console.log("unreachable: %zz was accepted")
  return 0
}
