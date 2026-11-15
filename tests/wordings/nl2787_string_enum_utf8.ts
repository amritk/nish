// A string enum's values are matched against JSON, so each is valid UTF-8.
enum Role {
  Bad = "\uD800",
}

export const test = (): i32 => 0;
