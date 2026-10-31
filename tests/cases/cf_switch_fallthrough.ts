// A clause with statements that does not end in a `break`, `return` or
// `continue` runs on into the next clause, as in TypeScript: the branch
// falls into the next clause's block, with no flag.
function grade(n: number): number {
  let points = 0;
  switch (n) {
    case 3:
      points += 100;
    case 2:
      points += 10;
    case 1:
      points += 1;
      break;
    default:
      points = -1;
  }
  return points;
}

function last(n: number): number {
  let out = 0;
  switch (n) {
    case 0:
      out = 5;
    default:
      out += 1;
  }
  return out;
}

export function test(): number {
  return grade(3) + grade(2) + grade(1) + grade(9) + last(0) + last(4);
}
