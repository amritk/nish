// A class another module's field initializers construct: one with a
// constructor and a defaulted parameter, and one with no constructor whose own
// initializers run when it is built.
export class Leaf {
  label: string
  value: i32

  constructor(value: i32, label: string = "leaf") {
    this.value = value
    this.label = label
  }
}

export class Tally {
  counts: i32[] = []
  total: i32 = 0
}
