// A caller contract one call does not prove (docs/LANGUAGE.md, "Panic sites").
// `sum` panics when `[start, end)` is outside `xs`. `whole` proves its call,
// but `9` is past the end of a buffer of four, so not every call into `sum`
// is proven, and its `panic` stays its own: `--deny-panics` (`args`) refuses
// it, and the call nothing proves reaches it as any call does.
// `caller_contract_proven` is the same callee with every call proven.
const sum = (xs: i32[], start: i32, end: i32): i32 => {
  if (start < 0 || end < start || end > toI32(xs.length)) {
    panic("sum: the range is outside the array")
  }
  return end - start
}

const whole = (xs: i32[]): i32 => sum(xs, 0, toI32(xs.length))

export const main = (): i32 => {
  const a = whole([1, 2, 3, 4])
  const b = sum([1, 2, 3, 4], 1, 9)
  return a > 0 && b > 0 ? 1 : 0
}
