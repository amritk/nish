// NL2819: `Even` constructs an `Odd` in an initializer and `Odd` constructs an
// `Even`, so building either one would never end. The loop is refused at the
// first class whose initializers lead back to it.
import { Leaf } from "./leaf"

class Even {
  leaf: Leaf = new Leaf(2)
  next: Odd | null = new Odd()
}

class Odd {
  next: Even | null = new Even()
}

export const main = (): i32 => new Even().leaf.value
