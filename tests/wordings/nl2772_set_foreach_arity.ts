// NL2772: A `Set`'s `forEach` callback takes the element alone; JavaScript passes it
// twice, and the set third, and Nish refuses the second parameter.
export const main = (): i32 => {
  const s = new Set<i32>()
  s.add(1)
  s.forEach((v, again) => console.log(v + again))
  return 0
}
