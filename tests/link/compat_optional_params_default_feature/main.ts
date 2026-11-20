// NL2203: a compat program whose `nish.compat` leaves out `optional-params`
// refuses a default that is not a constant, as the strict dialect does.
const twice = (n: number): number => n * 2

const scale = (width: number, factor: number = twice(width)): number => {
  return width * factor
}

export const main = (): i32 => (scale(2) === 8 ? 0 : 1)
