// NL2801: a `new` whose arguments no constructor signature takes is refused,
// although the implementation would take them.
class Scale {
  factor: number
  constructor()
  constructor(factor: number)
  constructor(factor: number = 2, offset: number = 0) {
    this.factor = factor + offset
  }
}

export const main = (): i32 => (new Scale(1, 2).factor === 3 ? 0 : 1)
