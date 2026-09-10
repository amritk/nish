const double = (n: i32): i32 => n * 2;

export function main(): number {
  const alias = double;
  return alias(1);
}
