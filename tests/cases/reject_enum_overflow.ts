// The representation is `i32`, so a member that does not fit is an error
// rather than a wrap, exactly as a module constant's value is.
enum Kind {
  Big = 5000000000,
}

export const test = (): i32 => 0;
