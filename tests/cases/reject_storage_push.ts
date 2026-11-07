// Storage has a fixed length: `push` is refused.
const xs = new Int32Array(4)

export const main = (): void => {
  xs.push(1)
}
