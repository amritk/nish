// A constant table cannot be widened to a mutable array through a local.
const XS: readonly f64[] = [1.5, 2.5]

export const main = (): void => {
  const ys: f64[] = XS
  ys[0] = 3.5
}
