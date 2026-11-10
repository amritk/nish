// A callback that declares no parameter is refused, though TypeScript accepts
// it: the template is picked by the callback's arity, and there is none for
// zero. The message counts the arguments as written, after the receiver.
export const main = (): number => {
  const xs: number[] = [3, 1, 2]
  const ys = xs.map(() => 0)
  return ys[0]
}
