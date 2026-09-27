// WP31 §4: a literal type argument to a user template would be a const
// generic, which nothing has designed, so `Box<3>` is refused by the same rule.
class Box<T> {
  value: T
  constructor(value: T) {
    this.value = value
  }
}

const make = (): Box<3> => new Box<i32>(3)

export const main = (): number => make().value
