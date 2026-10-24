// A field initializer of a generic class nothing instantiates is walked
// without types like its methods: `new Array<T>(n)` fills with a zero only an
// instance knows.
const n: i32 = 4

class Shelf<T> {
  items: T[] = new Array<T>(n)
}

export const main = (): number => {
  console.log("shelf")
  return 0
}
