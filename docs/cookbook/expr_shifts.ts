function constantCount(a: i32): i32 {
  return a >> 3;
}

function variableCount(a: i32, n: i32): i32 {
  return a << n;
}

function fills(a: i32, n: i32): i32 {
  return (a >> n) + (a >>> n);
}

function wide(a: i64, n: i64): i64 {
  return a << n;
}
