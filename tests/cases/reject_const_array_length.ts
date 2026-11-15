// A constant table's length is fixed: writing it is refused like any write.
const XS: readonly i32[] = [1, 2, 3]

export const main = (): void => {
  XS.length = 1
}
