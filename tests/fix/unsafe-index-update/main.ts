// Every compound store, as a statement with plain operands, becomes a read and
// a write. A right side that is not a single operand is parenthesised, so
// `xs[k] -= v * 2` subtracts the product.
export const mix = (xs: i32[], k: i32, v: i32): void => {
  xs[k] += v
  xs[k] -= v * 2
  xs[k] *= 3
  xs[k] /= v + 1
  xs[k] %= 7
  xs[k] &= v
  xs[k] |= 1
  xs[k] ^= v
  xs[k] <<= 1
  xs[k] >>= 2
  xs[k] >>>= 1
}
