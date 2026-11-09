// WP50 stage 4: a callee lent byte storage may not alias its `u8[]`
// parameter, which would let the alias grow the storage out of sight.
const S = new Array<u8>(8)

const keep = (buf: u8[]): i32 => {
  const b = buf
  return b.length
}

export const main = (): void => {
  console.log(`${keep(S)}`)
}
