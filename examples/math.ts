// Ranged integers state how large each input may be, so the compiler proves
// every `*`, `+` and `-` below fits an `i32` and none of them can overflow.
const square = (x: integer<-1000, 1000>): i32 => x * x

// One expression: a range is read through the operators of an expression, not
// through a local it was stored in, so the sum is written where it is returned.
const polynomial = (x: integer<-1000, 1000>, k: integer<-1000, 1000>): i32 => x * x * 3 + k * 2 - 7

const isPositive = (n: number): boolean => n > 0
