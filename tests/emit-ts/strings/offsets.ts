// Every byte-offset member of a string past ASCII: each counts UTF-8 bytes
// natively, so each is written as the core helper that counts them, and
// `startsWith` and `endsWith`, which answer the same over code units, stay.

const word: string = "héllo"
const face: string = "a😀b"

export const main = (): number => {
  console.log(`${word.length} ${face.length}`)
  console.log(`${word.charCodeAt(1)} ${word.charCodeAt(2)} ${face.charCodeAt(4)}`)
  console.log(`${word.indexOf("l")} ${word.indexOf("l", 4)} ${word.indexOf("é")} ${face.indexOf("b")}`)
  console.log(`${word.indexOf("", 99)} ${word.indexOf("x")}`)
  console.log(word.slice(1, 3))
  console.log(word.slice(3))
  console.log(word.substring(3, 1))
  console.log(face.substring(1, 5))
  console.log(`${word.startsWith("hé")} ${word.endsWith("lo")}`)
  return 0
}
