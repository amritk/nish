// Both ends are byte offsets, so a string end is a type error rather than
// something coerced: the language has no implicit conversion.
const f = (bytes: u8[]): string => String.fromBytes(bytes, 0, "2");
