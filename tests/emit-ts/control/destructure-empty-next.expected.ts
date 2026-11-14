// A pattern with no names, then another pattern in the same declaration.
// `const [] = none()` binds only its hidden receiver; the bounds checks its
// names need are none, and the next pattern's reads are that pattern's own,
// against its own receiver. Checking `a`'s index against `none()`'s empty
// array would panic under Node where the native program prints 14.
import { idx, checkedMul } from "nish/runtime"
import type { i32 } from "nish/runtime"
const none = (): i32[] => []

const seven = (): i32[] => [7]

export const main = (): number => {
  const xs = seven()
  const [] = none(), [a] = ((__t0) => (idx(__t0, 0), __t0))(xs)
  console.log(`${checkedMul(a, 2)}`)
  const [, ] = none(), [b] = xs
  console.log(`${checkedMul(b, 2)}`)
  const [] = none(), [c] = ((__t1) => (idx(__t1, 0), __t1))(seven())
  console.log(`${checkedMul(c, 2)}`)
  return 0
}
