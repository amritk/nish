// NL9017: a call through a reference whose set holds more than eight
// functions branches on a `switch` of them where a direct call would not.
function f0(x: i32): i32 {
  return x + 0;
}

function f1(x: i32): i32 {
  return x + 1;
}

function f2(x: i32): i32 {
  return x + 2;
}

function f3(x: i32): i32 {
  return x + 3;
}

function f4(x: i32): i32 {
  return x + 4;
}

function f5(x: i32): i32 {
  return x + 5;
}

function f6(x: i32): i32 {
  return x + 6;
}

function f7(x: i32): i32 {
  return x + 7;
}

function f8(x: i32): i32 {
  return x + 8;
}

export const main = (): i32 => {
  const ops: ((x: i32) => i32)[] = [f0, f1, f2, f3, f4, f5, f6, f7, f8];
  let total = 0;
  for (const op of ops) {
    total = total + op(2);
  }
  return total;
};
