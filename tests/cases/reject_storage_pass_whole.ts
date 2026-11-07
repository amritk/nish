// Storage itself is a place: passing the array is refused.
const xs = new Int32Array(4)

const total = (a: i32[]): i32 => a[0]

export const main = (): void => {
  console.log(`${total(xs)}`)
}
