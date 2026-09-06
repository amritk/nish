// Boolean truth tables, negation, equality on booleans, comparisons of every numeric type.
function xor(a: boolean, b: boolean): boolean {
  return (a || b) && !(a && b);
}

function implies(a: boolean, b: boolean): boolean {
  return !a || b;
}

export function main(): number {
  const vals = [false, true];
  for (const a of vals) {
    for (const b of vals) {
      console.log(`${a} ${b}: and=${a && b} or=${a || b} xor=${xor(a, b)} implies=${implies(a, b)} eq=${a === b} ne=${a !== b}`);
    }
  }
  console.log(!true);
  console.log(!!true);
  console.log(!(1 < 2));
  const tenth: f64 = 0.1;
  const f = tenth + 0.2;
  console.log(f === 0.3);
  console.log(f > 0.3);
  console.log(f <= 0.30000000000000004);
  const z: f64 = 0;
  const nan = z / z;
  console.log(nan === nan);
  console.log(nan !== nan);
  console.log(nan < 1);
  console.log(nan >= 1);
  console.log(1 / z > 1e308);
  const big: i64 = 3000000000;
  console.log(big > 2147483647);
  console.log(big * big < 0);
  console.log(big * big * big < 0);
  const min = -2147483647 - 1;
  console.log(min < 0);
  console.log(min - 1 > 0);
  console.log(min === min * -1);
  console.log(2147483647 + 1 === min);
  console.log("a" === "a" && "a" !== "b");
  console.log((3 > 2) === (2 > 1));
  console.log((3 > 2) !== (1 > 2));
  return 0;
}
