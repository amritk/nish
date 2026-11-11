// WP50 stage 4: a callee lent byte storage may not return its `u8[]`
// parameter, which the caller could then grow.
const S = new Array<u8>(8)

const id = (buf: u8[]): u8[] => {
  return buf
}

export const main = (): void => {
  console.log(`${id(S).length}`)
}
