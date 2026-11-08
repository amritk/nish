// Storage has a fixed length: `pop` is refused.
const xs = new Array<f64>(4)

export const main = (): void => {
  console.log(`${xs.pop()}`)
}
