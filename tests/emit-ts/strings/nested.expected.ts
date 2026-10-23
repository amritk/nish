// Rewrites inside rewrites: a helper call is the receiver or an argument of
// another, and each is spliced into the one around it.
import { indexOf, slice, strLen, charCodeAt, substring } from "nish/runtime"

const word: string = "héllo"

export const main = (): number => {
  console.log(slice(word, 0, indexOf(word, "é")))
  console.log(strLen(slice(word, 1)))
  console.log(charCodeAt(word, strLen(word) - 1))
  console.log(indexOf(slice(word, 1), "l"))
  console.log(substring((word + "!"), indexOf(word, "l"), strLen(word) + 1))
  return 0
}
