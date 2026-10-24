// Rewrites inside rewrites: a helper call is the receiver or an argument of
// another, and each is spliced into the one around it.

const word: string = "héllo"

export const main = (): number => {
  console.log(word.slice(0, word.indexOf("é")))
  console.log(word.slice(1).length)
  console.log(word.charCodeAt(word.length - 1))
  console.log(word.slice(1).indexOf("l"))
  console.log((word + "!").substring(word.indexOf("l"), word.length + 1))
  return 0
}
