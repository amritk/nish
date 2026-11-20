// NL2801: a call the implementation would take, but no overload signature
// does, is refused, as tsc refuses it (TS2575).
function volume(side: number): number
function volume(width: number, height: number, depth: number): number
function volume(width: number, height: number = -1, depth: number = 1): number {
  return height < 0 ? width * width * width : width * height * depth
}

export const main = (): i32 => (volume(3, 4) > 0 ? 0 : 1)
