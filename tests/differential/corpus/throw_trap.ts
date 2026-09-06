// throw traps (SIGILL) after the earlier output has been written.
function checkedDiv(a: number, b: number): number {
  if (b === 0) {
    throw 1;
  }
  return a / b;
}

export function main(): number {
  console.log(checkedDiv(84, 2));
  console.log(checkedDiv(-9, 4));
  console.log("about to throw");
  console.log(checkedDiv(1, 0));
  console.log("not printed");
  return 0;
}
