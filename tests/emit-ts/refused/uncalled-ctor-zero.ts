// The constructor of a generic class nothing instantiates is walked without
// types too: `new Array<T>(n)` fills with a zero only an instance knows.
class Grid<T> {
  items: T[]
  constructor(n: i32) {
    this.items = new Array<T>(n)
  }
}

export const main = (): number => {
  console.log("grid")
  return 0
}
