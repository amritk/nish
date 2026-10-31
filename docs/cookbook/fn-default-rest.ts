const scale = (x: i32, by: i32 = 2): i32 => x * by

const total = (...xs: i32[]): i32 => {
  let sum = 0
  for (const x of xs) {
    sum += x
  }
  return sum
}

export const main = (): i32 => scale(3) + total(1, 2, 3)
