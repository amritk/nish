// NL2801 on a method, called through a parenthesised receiver: the call is
// held to the signatures, not to the implementation's own.
class Scale {
  apply(x: number): number
  apply(x: number, offset: number, times: number): number
  apply(x: number, offset: number = 0, times: number = 1): number {
    return (x * 2 + offset) * times
  }
}

export const main = (): i32 => {
  const s = new Scale()
  return (s).apply(1, 2) > 0 ? 0 : 1
}
