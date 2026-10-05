// A compound store becomes a read and a write that evaluate the array and the
// index twice, so each operand has to be a plain read. Here the right side of
// one and the index of the other call a function: both are reported without a
// fix.
const next = (k: i32): i32 => k + 1

export const bump = (xs: i32[], k: i32): void => {
  xs[k] += next(k)
  xs[next(k)] += 1
}
