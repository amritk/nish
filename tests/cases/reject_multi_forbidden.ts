function f(a: number): number {
  return eval("a");
}

function g(a: number): number {
  return typeof a === "number" ? a : 0;
}

function h(x: number): number {
  delete x;
  return x;
}
