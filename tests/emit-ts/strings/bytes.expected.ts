// `String.fromBytes` decodes its range as UTF-8, as a native string holds it,
// and `String.fromCharCode` builds its one byte: both through the core's
// helpers rather than the globals.
import { utf8FromBytes, strLen, fromCharCode } from "nish/runtime"
import type { u8 } from "nish/runtime"

export const main = (): number => {
  const bytes: u8[] = [104, 195, 169, 33]
  console.log(utf8FromBytes([195, 169], 0, 2))
  console.log(utf8FromBytes(bytes, 0, bytes.length))
  console.log(strLen(utf8FromBytes(bytes, 1, 3)))
  console.log(fromCharCode(65) + fromCharCode(321))
  return 0
}
