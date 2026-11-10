// A named callback must have exactly the parameter's function type. The
// message counts the arguments as written: the callback is argument 1 of
// `filter`, the receiver is not counted.
const empty = (s: string): boolean => s === ""

export const main = (): number => {
  const xs: number[] = [3, 1, 2]
  return xs.filter(empty).length
}
