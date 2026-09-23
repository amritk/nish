// WP18 G8: a generic method of a generic class. `Box<T>.pair<U>` is keyed by
// the receiver instantiation *and* the method's tuple, so two receivers
// (`Box<i32>`, `Box<string>`) times two method tuples (`i32`, `string`) are four
// defines — `@Box$i32.pair$i32`, `@Box$i32.pair$str`, `@Box$str.pair$i32`,
// `@Box$str.pair$str` — and the repeated calls ask for no fifth. Inside the
// body the class's `T` and the method's `U` are both bound.
class Pair<A, B> {
  first: A;
  second: B;

  constructor(first: A, second: B) {
    this.first = first;
    this.second = second;
  }
}

class Box<T> {
  value: T;

  constructor(value: T) {
    this.value = value;
  }

  pair<U>(other: U): Pair<T, U> {
    return new Pair<T, U>(this.value, other);
  }
}

export const test = (): number => {
  const n = new Box<i32>(7);
  const s = new Box<string>("seven");
  const a = n.pair(1);
  const b = n.pair("one");
  const c = s.pair(2);
  const d = s.pair("two");
  const again = n.pair(3);
  console.log(`${b.second} ${c.first} ${d.first}${d.second}`);
  return a.first + a.second + c.second + again.second;
};
