// Storage has a fixed length: assigning `length` is refused.
const xs = new Float64Array(4)

export const main = (): void => {
  xs.length = 2
}
