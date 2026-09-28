// WP31 §8: a range entry the bounds proof could not place inside its range,
// inside a loop, warns and names the rewrite that would prove it. The program
// is legal, every value is in range, and it exits 0.
class Tally {
  hits: integer<0, 1000> = 0
}

export const main = (): number => {
  const xs = [4, 8, 15, 16, 23, 42]
  const t = new Tally()
  let total = 0
  for (let k = 0; k < xs.length; k++) {
    // A local with nothing below 100 on it: the guard is named.
    const w: integer<0, 99> = k
    // A computed value has no guard of its own.
    const v: integer<0, 99> = xs[k]
    // A range with no lower end asks for the upper one alone.
    const top: integer<-2147483648, 99> = k
    // A store back into a ranged place is a sum, and warns at its target.
    t.hits += 1
    // A range starting above zero is never proven from a guard, so there is
    // no rewrite to name: the entry is checked and nothing is reported.
    const day: integer<1, 31> = k + 1
    total = total + w + v + top + day
  }
  console.log(`${total} ${t.hits}`)
  return 0
}
