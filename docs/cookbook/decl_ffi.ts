declare function abs(n: i32): i32;

function pureDouble(n: i32): i32 {
  return n * 2;
}

export function main(): i32 {
  return abs(-7) + pureDouble(3);
}
