// The `switch`-discriminant shape run out of range: the input stops at the
// runtime's index error, the fixed program at the guard's panic, and both
// print the same lines first and exit 1.
const countOnes = (xs: i32[], idx: i32[]): i32 => {
  let count = 0
  for (const i of idx) {
    console.log(`at ${i}`)
    if (!(i >= 0 && i < toI32(xs.length))) { panic("index out of range") }
    switch (xs[i]) {
      case 1:
        count = count + 1
        break
    }
  }
  return count
}

export const main = (): number => {
  console.log(`${countOnes([1, 2, 1], [0, -1, 2])}`)
  return 0
}
