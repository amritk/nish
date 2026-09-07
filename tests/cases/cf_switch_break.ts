// `break` inside a `switch` leaves the switch, `continue` skips past it to
// the enclosing loop, and a `switch` with no `default` falls straight out.
const KIND_SKIP: i32 = 3;

function score(limit: number): number {
  let total = 0;
  for (let i = 0; i < limit; i++) {
    switch (i) {
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
  return total;
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

function test(): number {
  return score(6) + toI32(widen(2));
}
