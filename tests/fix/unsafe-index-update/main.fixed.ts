// Every compound store, as a statement with plain operands, becomes a read and
// a write. A right side that is not a single operand is parenthesised, so
// `xs[k] -= v * 2` subtracts the product.
import { uncheckedGet, uncheckedSet } from "nish:unsafe"

export const mix = (xs: i32[], k: i32, v: i32): void => {
  uncheckedSet(xs, k, uncheckedGet(xs, k) + v)
  uncheckedSet(xs, k, uncheckedGet(xs, k) - (v * 2))
  uncheckedSet(xs, k, uncheckedGet(xs, k) * 3)
  uncheckedSet(xs, k, uncheckedGet(xs, k) / (v + 1))
  uncheckedSet(xs, k, uncheckedGet(xs, k) % 7)
  uncheckedSet(xs, k, uncheckedGet(xs, k) & v)
  uncheckedSet(xs, k, uncheckedGet(xs, k) | 1)
  uncheckedSet(xs, k, uncheckedGet(xs, k) ^ v)
  uncheckedSet(xs, k, uncheckedGet(xs, k) << 1)
  uncheckedSet(xs, k, uncheckedGet(xs, k) >> 2)
  uncheckedSet(xs, k, uncheckedGet(xs, k) >>> 1)
}
