// `forEach` answers `void`, so it cannot be returned from a function that
// answers `i32`.
const show = (x: i32): void => {
  console.log(`${x}`)
}

const walk = (xs: i32[]): i32 => {
  return xs.forEach(show)
}

export const main = (): i32 => walk([1])
