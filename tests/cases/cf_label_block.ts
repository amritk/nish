// A labelled block is left early by a `break` that names it: the rest of
// the block is skipped and the statement after it runs, on every path.
function classify(n: number): number {
  let kind = 0;
  check: {
    if (n < 0) {
      kind = 1;
      break check;
    }
    if (n === 0) {
      kind = 2;
      break check;
    }
    kind = 3;
  }
  return kind * 10;
}

function scan(xs: number[]): number {
  let hits = 0;
  for (const x of xs) {
    body: {
      if (x % 2 === 0) {
        break body;
      }
      hits += x;
    }
    hits += 100;
  }
  return hits;
}

export function test(): number {
  return classify(-4) + classify(0) + classify(9) + scan([1, 2, 3, 4]);
}
