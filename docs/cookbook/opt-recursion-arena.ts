const digits = (n: i32): i32 => {
  if (n <= 0) {
    return 0
  }
  const s = `${n}`
  return s.length + digits(n - 1)
}

export const test = (): i32 => digits(100000)
