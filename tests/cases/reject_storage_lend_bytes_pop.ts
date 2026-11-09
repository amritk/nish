// WP50 stage 4: `pop` shrinks the storage through its static header, as
// `push` grows it, so a callee lent byte storage may not call it.
const S = new Array<u8>(8)

const shrink = (buf: u8[]): void => {
  buf.pop()
}

export const main = (): void => {
  shrink(S)
  console.log(`${S.length}`)
}
