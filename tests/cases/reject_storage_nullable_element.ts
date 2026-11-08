// A `T | null` element is a pointer, so storage refuses it.
interface P {
  x: f64
}

const ps = new Array<P | null>(4)

export const main = (): void => {
  console.log(`${ps.length}`)
}
