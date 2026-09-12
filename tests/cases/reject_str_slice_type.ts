// Both offsets are byte offsets, so a string argument is a type error rather
// than something coerced: the language has no implicit conversion.
const f = (s: string): string => s.slice("1");
