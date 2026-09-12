// `i32` is resolved as a type reference before any declared name, so an enum
// under that name would never be looked at.
enum i32 {
  A = 1,
}

export const test = (): number => 0;
