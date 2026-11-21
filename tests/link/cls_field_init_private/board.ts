// NL2820: `Board` is exported and has no constructor, so its initializers run
// in whichever module writes `new Board()`, where `Pin`'s constructor, private
// to this module, cannot be called.
class Pin {
  value: i32

  constructor(value: i32) {
    this.value = value
  }
}

export class Board {
  pin: Pin = new Pin(1)
}
