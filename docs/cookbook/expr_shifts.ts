const constantCount = (a: i32): i32 => a >> 3;

const variableCount = (a: i32, n: i32): i32 => a << n;

const fills = (a: i32, n: i32): i32 => (a >> n) + (a >>> n);

const wide = (a: i64, n: i64): i64 => a << n;
