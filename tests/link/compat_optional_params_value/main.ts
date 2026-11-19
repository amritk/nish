// NL2804: an `x?` parameter of a type with no `null` has nothing to stand
// for the omitted argument, so it is refused with the default to write.
const scale = (width: number, factor?: number): number => {
  return width * (factor ?? 1)
}

export const main = (): i32 => (scale(2) === 2 ? 0 : 1)
