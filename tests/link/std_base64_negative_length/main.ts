// `nish/base64`: a negative byte count has no encoded length, and panics.
import { base64EncodedLength } from "nish/base64"

export const main = (): i32 => {
  console.log(`${base64EncodedLength(3)}`)
  console.log(`${base64EncodedLength(-1)}`)
  return 0
}
