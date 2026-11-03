// The comparator's own arithmetic is checked: `a - b` on i32 overflows for
// 2147483647 and -2 whichever way round the sort asks, and the sort stops with
// that panic rather than ordering by a wrapped answer. (With -1 only
// `2147483647 - -1` overflows, and which pair a sort compares in which order
// is not part of `Array.prototype.sort`'s contract, so -1 would pin V8's call
// order, not the check.) The overflow-free comparator the docs give sorts the
// full i32 range. The case has no `.out`: `tests/run.js` checks the line
// before the panic and the panic.

const ordered = (a: i32, b: i32): number => (a > b ? 1 : a < b ? -1 : 0)
const difference = (a: i32, b: i32): number => a - b

const show = (xs: i32[]): string => {
  let line = ""
  for (const x of xs) {
    line = line === "" ? `${x}` : `${line},${x}`
  }
  return line
}

export function main(): number {
  const safe: i32[] = [2147483647, -1, 0, -2147483648]
  console.log(show(safe.sort(ordered)))
  const wide: i32[] = [2147483647, -2]
  console.log(show(wide.sort(difference)))
  return 0
}
