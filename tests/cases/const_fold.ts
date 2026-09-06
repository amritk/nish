// Arithmetic over constants is folded at compile time, including the
// comparison: the body of `test` must contain no `add` and no `icmp`.
const WIDTH: i32 = 8;
const HEIGHT: i32 = 4;
const AREA: i32 = WIDTH * HEIGHT;
const HALF: i32 = AREA / 2;
const WIDE: boolean = WIDTH > HEIGHT;

function test(): number {
  if (WIDE) {
    return HALF;
  }
  return 0;
}
