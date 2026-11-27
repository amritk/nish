// examples-strict S1 (#2316): a guard against a function `const` orders an
// offset index the way a guard against a literal does. `i + 1 < top`, with
// `top` a `const` of 4, holds `i` at most 2, so `BOX[i + 1]` is proven into
// the storage's four slots and its sum cannot overflow: it compiles under
// --deny-panics with no bounds or overflow check left. Without the guard
// reading `top` as the constant 4 (`constantValue`'s function `const`s), both
// sites in the `return` are refused. `i < 100` bounds the guard's own sum, and
// the argument comes from `parseInt`, so no call site's range proves a site.
const BOX = new Int32Array(4)

const next = (i: i32): i32 => {
  const top: i32 = 4
  if (i >= 0 && i < 100 && i + 1 < top) {
    return BOX[i + 1]
  }
  return -1
}

export const main = (): void => {
  BOX[3] = 7
  console.log(`${next(parseInt("2"))} ${next(parseInt("3"))}`)
}
