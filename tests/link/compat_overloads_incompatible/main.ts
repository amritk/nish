// NL2800: a signature whose parameter the implementation's does not take.
function show(value: string): number
function show(value: number): number {
  return value
}

export const main = (): i32 => (show(1) > 0 ? 0 : 1)
