// WP31 §6: through a field, `push` still gives the range to a literal, so one
// outside it is a compile error rather than a check at run time.
class Digits {
  items: integer<0, 9>[]

  constructor() {
    this.items = []
  }

  addTwelve(): void {
    this.items.push(12)
  }
}

export const main = (): number => {
  const d = new Digits()
  d.addTwelve()
  return d.items.length
}
