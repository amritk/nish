// Three `\u{...}` spellings the strings row has to keep apart. `"\\u{41}"` is
// a backslash and then `u{41}`, six bytes, and is no escape; `"\u{D800}"` is a
// lone surrogate, written `\uD800`; `"\u{1F600}"` is past U+FFFF, written as
// its pair `😀`, the one spelling every engine reads. Each prints
// its UTF-8 length, and the first its first byte.
import { strLen, charCodeAt } from "nish/runtime"
export const main = (): number => {
  const slash: string = "\\u{41}"
  const lone: string = "\uD800"
  const astral: string = "\uD83D\uDE00"
  console.log(`${strLen(slash)} ${charCodeAt(slash, 0)} ${charCodeAt(slash, 1)}`)
  console.log(`${strLen(lone)}`)
  console.log(`${strLen(astral)} ${astral === "😀"}`)
  return 0
}
