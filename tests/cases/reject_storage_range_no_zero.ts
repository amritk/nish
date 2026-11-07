// Storage is zero-filled, so a range that excludes 0 is refused.
const levels = new Array<integer<1, 3>>(4)

export const main = (): void => {
  console.log(`${levels.length}`)
}
