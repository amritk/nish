// NL2188: a class that cannot be `null` is always truthy, so the condition is
// constant and a comparison would only hide that; there is no fix.
class Cell {
  value: i32 = 0
}
export const test = (c: Cell): number => {
  if (c) {
    return 1
  }
  return 0
}
