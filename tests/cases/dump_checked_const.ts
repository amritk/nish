// A module constant's whole existence is its folded value, so `--emit-checked`
// prints the value rather than the expression that produced it.
const WIDTH: i32 = 8;
const AREA: i32 = WIDTH * WIDTH;
const NAME: string = "box";

export function test(): number {
  console.log(NAME);
  return AREA;
}
