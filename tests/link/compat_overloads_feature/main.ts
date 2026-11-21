// NL2204: a compat program whose `nish.compat` leaves out `overloads` refuses
// an overload signature as a missing body, and names the feature.
function area(side: number): number
function area(width: number, height: number = -1): number {
  return height < 0 ? width * width : width * height
}

export const main = (): i32 => (area(3) > 0 ? 0 : 1)
