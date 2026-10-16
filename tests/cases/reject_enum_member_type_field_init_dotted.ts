// A dotted field initializer whose receiver is not an enum is still refused:
// only literals and enum members fold to a constant.
enum Kind {
  Scalar,
  Array,
}

const name: string = "ab";

class Counter {
  n: i32 = name.length;
}

export const test = (): number => new Counter().n + (Kind.Array === Kind.Array ? 1 : 0);
