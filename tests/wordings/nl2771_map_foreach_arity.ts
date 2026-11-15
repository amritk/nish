// NL2771: A `Map`'s `forEach` callback takes the value, or the value and its key;
// JavaScript's third parameter, the map, is refused.
export const main = (): i32 => {
  const m = new Map<string, i32>()
  m.set("a", 1)
  m.forEach((v, k, all) => console.log(`${k}${v}${all.size}`))
  return 0
}
