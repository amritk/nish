function divide(a: u32, b: u32): u32 {
  return a / b;
}

function below(a: u32, b: u32): boolean {
  return a < b;
}

function halve(a: u32): u32 {
  return a >> 1;
}

function widen(a: u32): u64 {
  return toU64(a);
}

function reinterpret(a: i32): u32 {
  return toU32(a);
}
