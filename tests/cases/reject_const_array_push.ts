// A constant table cannot grow: `push` is refused like any write.
const XS: readonly i64[] = [1, 2, 3]

export const main = (): void => {
  XS.push(toI64(4))
}
