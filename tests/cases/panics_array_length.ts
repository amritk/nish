// Panic sites: `new Array<T>(n)` checks a length whose type could make a bad
// header (an `i64`, a float); an `i32` length or a literal is not checked.
const fromWide = (n: i64): i32[] => new Array<i32>(n)

const fromNarrow = (n: i32): i32[] => new Array<i32>(n)

export const main = (): number => {
  console.log(fromWide(toI64(3)).length)
  console.log(fromNarrow(2).length)
  return 0
}
