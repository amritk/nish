// WP50 stage 4: `length++` assigns the length of a lent `u8[]` as surely as
// `length =` does, so a callee that does it is refused at the lending.
const S = new Array<u8>(8)

const bump = (buf: u8[]): void => {
  buf.length++
}

export const main = (): void => {
  bump(S)
  console.log(`${S.length}`)
}
