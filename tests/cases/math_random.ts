// Math.random() -> sts_random(): a double in [0, 1). Without loops (WP1) the
// 1000 draws are unrolled through fixed-arity helpers: `bad()` is 0 for a draw
// in range and non-zero otherwise (floor of a value outside [0, 1) is not 0).
function bad(): number {
  return toI32(Math.floor(Math.random()));
}

function bad10(): number {
  return bad() + bad() + bad() + bad() + bad() + bad() + bad() + bad() + bad() + bad();
}

function bad100(): number {
  return bad10() + bad10() + bad10() + bad10() + bad10() + bad10() + bad10() + bad10() + bad10() + bad10();
}

function bad1000(): number {
  return bad100() + bad100() + bad100() + bad100() + bad100() + bad100() + bad100() + bad100() + bad100() + bad100();
}

function test(): number {
  console.log(bad1000());
  console.log(Math.random() !== Math.random());
  return 0;
}
