// WP50 stage 4: a compound `length +=` on a lent `u8[]` is an assignment to
// its length, so a callee that does it is refused at the lending.
const S = new Array<u8>(8)

const widen = (buf: u8[]): void => {
  buf.length += 4
}

export const main = (): void => {
  widen(S)
  console.log(`${S.length}`)
}
