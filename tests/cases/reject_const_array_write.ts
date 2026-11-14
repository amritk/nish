// A constant table lives in read-only data: an element write is refused.
const XS: readonly u8[] = [1, 2, 3]

export const main = (): void => {
  XS[0] = 4
}
