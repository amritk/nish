function checkedDiv(a: number, b: number): number {
  if (b === 0) {
    throw 1;
  }
  return a / b;
}

function neverReturns(): number {
  throw 42;
}

function test(): number {
  return checkedDiv(84, 2);
}
