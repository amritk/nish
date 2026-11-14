// A string enum has no numbering to fall back on, so a member without an
// initializer is refused rather than given a number.
enum Role {
  Admin = "admin",
  Guest,
}

export const test = (): i32 => 0;
