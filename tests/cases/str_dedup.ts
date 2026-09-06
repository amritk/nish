function first(): string {
  return "same";
}

function second(): string {
  return "same";
}

function test(): number {
  console.log(first());
  console.log(second());
  console.log("same" === second());
  return 0;
}
