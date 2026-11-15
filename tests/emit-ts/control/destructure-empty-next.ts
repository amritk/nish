// A pattern with no names, then another pattern in the same declaration.
// `const [] = none()` binds only its hidden receiver; the bounds checks its
// names need are none, and the next pattern's reads are that pattern's own,
// against its own receiver. Checking `a`'s index against `none()`'s empty
// array would panic under Node where the native program prints 14.
const none = (): i32[] => []

const seven = (): i32[] => [7]

export const main = (): number => {
  const xs = seven()
  const [] = none(), [a] = xs
  console.log(`${a * 2}`)
  const [, ] = none(), [b] = xs
  console.log(`${b * 2}`)
  const [] = none(), [c] = seven()
  console.log(`${c * 2}`)
  return 0
}
