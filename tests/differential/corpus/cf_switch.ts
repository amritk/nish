// `switch` against Node: the label grouping, the default edge, `break` and
// `continue` reaching past the switch to the enclosing loop, and an i64
// discriminant, whose labels are BigInt literals in JavaScript.
const KIND_SKIP: i32 = 3;

function classify(n: number): string {
  switch (n) {
    case 0:
      return "zero";
    case 1:
    case 2:
      return "small";
    case -1:
      return "negative";
    default:
      return "other";
  }
}

function widen(w: i64): i64 {
  let out: i64 = 0;
  switch (w) {
    case 1:
      out = 11;
      break;
    case 2:
      out = 22;
      break;
  }
  return out;
}

export function main(): number {
  for (let i = -2; i < 4; i++) {
    console.log(classify(i));
  }
  let total = 0;
  for (let i = 0; i < 8; i++) {
    switch (i % 4) {
      case 0:
        total += 100;
        break;
      case KIND_SKIP:
        continue;
      default:
        total += 1;
    }
    total += 1000;
  }
  console.log(total);
  console.log(`${widen(1)} ${widen(2)} ${widen(9)}`);
  return 0;
}
