// Every byte-offset member of a string past ASCII: each counts UTF-8 bytes
// natively, so each is written as the core helper that counts them, and
// `startsWith` and `endsWith`, which answer the same over code units, stay.
import { strLen, charCodeAt, indexOf, slice, substring } from "nish/runtime"

const word: string = "héllo"
const face: string = "a😀b"

export const main = (): number => {
  console.log(`${strLen(word)} ${strLen(face)}`)
  console.log(`${charCodeAt(word, 1)} ${charCodeAt(word, 2)} ${charCodeAt(face, 4)}`)
  console.log(`${indexOf(word, "l")} ${indexOf(word, "l", 4)} ${indexOf(word, "é")} ${indexOf(face, "b")}`)
  console.log(`${indexOf(word, "", 99)} ${indexOf(word, "x")}`)
  console.log(slice(word, 1, 3))
  console.log(slice(word, 3))
  console.log(substring(word, 3, 1))
  console.log(substring(face, 1, 5))
  console.log(`${word.startsWith("hé")} ${word.endsWith("lo")}`)
  return 0
}
