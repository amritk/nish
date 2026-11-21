// NL2800: a signature that returns another type than the implementation.
function half(value: number): string
function half(value: number): number {
  return value / 2
}

export const main = (): i32 => (half(4) > 0 ? 0 : 1)
