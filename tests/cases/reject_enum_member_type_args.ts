// An enum member type takes no type arguments, and is refused as any other
// reference written with arguments it cannot take is.
enum Kind {
  Scalar,
  Array,
}

const tag = (k: Kind.Array<i32>): i32 => 0;

export const test = (): number => tag(Kind.Array);
