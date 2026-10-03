// Panic sites: a value entering `integer<Lo, Hi>` is checked unless the
// checker proves it in range. `digit(n)` cannot be proven, `guarded(n)`
// can behind its test, and `bump`'s compound store re-enters the range.
type Digit = integer<0, 9>

const digit = (n: i32): Digit => n

const guarded = (n: i32): Digit => {
  if (n >= 0 && n <= 9) {
    return n
  }
  return 0
}

const bump = (d: Digit): Digit => {
  let e: Digit = d
  e += 1
  return e
}

export const main = (): number => {
  console.log(digit(7))
  console.log(guarded(12))
  console.log(bump(3))
  return 0
}

// A host may call an exported function with any `int32_t`, so the function
// checks its ranged parameter itself, in its prologue: a site at the function.
export const fromHost = (d: Digit): i32 => d + 1
