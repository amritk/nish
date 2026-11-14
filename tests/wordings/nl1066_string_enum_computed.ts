// A string enum's values are a table fixed at declaration, so a computed value
// is refused.
enum Role {
  Admin = "admin",
  Guest = "gu" + "est",
}

export const test = (): i32 => 0;
