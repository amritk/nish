// A storage length must be known at compile time, not computed by a call.
const size = (): i32 => 4

const xs = new Int32Array(size())

export const main = (): void => {
  console.log(`${xs.length}`)
}
