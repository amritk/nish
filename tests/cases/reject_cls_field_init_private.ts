// An exported generic class's initializers run where it is instantiated, so
// the class they construct must be exported too.
class Pin {
  value: i32 = 0
}

export class Holder<T> {
  item: T
  pin: Pin = new Pin()

  constructor(item: T) {
    this.item = item
  }
}

export const main = (): i32 => new Holder<i32>(3).item
