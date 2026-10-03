// NL2188: a string is truthy when it is not empty, so the fix reads its
// length. A name or a call takes `.length` as written; a conditional is
// parenthesised first, so that `.length` reads the whole of it.
const greet = (name: string): string => `hello ${name}`
export const test = (): number => {
  const name = "nish"
  let n: i32 = 0
  if (name) {
    n = n + 1
  }
  const picked = greet(name) ? 1 : 0
  if (n > 0 ? name : "") {
    n = n + 1
  }
  return n + picked
}
