const total = (n: i64): i64 => {
  if (n <= toI64(0)) {
    return toI64(0)
  }
  return n + total(n - toI64(1))
}

export const test = (): i64 => total(toI64(100000))
