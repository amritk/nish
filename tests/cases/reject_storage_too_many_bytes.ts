// A storage spans at most 256 MiB: 16,777,216 records of 32 bytes is 512 MiB,
// a data section past what a module can hold.
interface Wide {
  a: f64
  b: f64
  c: f64
  d: f64
}

const rows = new Array<Wide>(16777216)

export const main = (): void => {
  console.log(`${rows.length}`)
}
