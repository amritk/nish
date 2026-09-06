function checkedDiv(a: number, b: number): number {
  if (b === 0) {
    throw "division by zero";
  }
  return a / b;
}
