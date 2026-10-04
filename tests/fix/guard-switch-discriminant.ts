// The access is a `switch`'s discriminant, which runs before any case, so the
// assignments in the cases do not keep the guard out.
const countOnes = (xs: i32[], idx: i32[]): i32 => {
  let count = 0
  for (const i of idx) {
    switch (xs[i]) {
      case 1:
        count = count + 1
        break
    }
  }
  return count
}

export const main = (): number => {
  console.log(`${countOnes([1, 2, 1], [0, 1, 2])}`)
  return 0
}
