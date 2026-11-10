// WP50 stage 4: a callee lent byte storage through a `u8[]` parameter may not
// `push` onto it, which would grow the storage through its static header.
const S = new Array<u8>(8)

const grow = (buf: u8[]): void => {
  buf.push(1)
}

export const main = (): void => {
  grow(S)
  console.log(`${S.length}`)
}
