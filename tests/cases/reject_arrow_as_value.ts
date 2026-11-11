// WP51: a top-level function is a value (`const alias = double` is a function
// reference), but an arrow that captures a local is not: it needs an
// environment a reference does not carry. The refused `const` is one
// diagnostic; the call through it afterwards stays silent.
const double = (n: i32): i32 => n * 2

export function main(): number {
  const k = double(1)
  const alias = (n: i32): i32 => n * k
  return alias(1)
}
