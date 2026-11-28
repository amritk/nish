// Panic sites: `panic(message)` is one. A leading guard every call proves false
// (`checked(21)`) is proven; `tests/link/panic_caller_unproven` is the open one.
const checked = (n: i32): i32 => {
  if (n < 0) {
    panic("negative")
  }
  return n * 2
}

export const main = (): number => {
  console.log(checked(21))
  return 0
}
