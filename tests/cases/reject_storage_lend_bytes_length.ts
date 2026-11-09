// WP50 stage 4: a `u8[]` parameter has no typed-array spelling to forbid
// `length =`, so a callee lent byte storage that assigns its length is
// refused at the lending.
const S = new Array<u8>(8)

const shrink = (buf: u8[]): void => {
  buf.length = 0
}

export const main = (): void => {
  shrink(S)
  console.log(`${S.length}`)
}
