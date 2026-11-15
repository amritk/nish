// A constant table cannot shrink: `pop` is refused like `push`.
const XS: readonly u16[] = [1, 2, 3]

export const main = (): void => {
  XS.pop()
}
