// A constant table is `readonly`, so it cannot be handed to a parameter that
// may write it.
const XS: readonly i32[] = [1, 2, 3]

const bump = (xs: i32[]): void => {
  xs[0] = 9
}

export const main = (): void => {
  bump(XS)
}
