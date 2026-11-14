// The callback takes the element, or the element and its index; JavaScript's
// third parameter, the array, is refused.
export const main = (): i32 => {
  const xs: i32[] = [3, 1, 2]
  xs.forEach((x, i, all) => console.log(x + i + all.length))
  return 0
}
