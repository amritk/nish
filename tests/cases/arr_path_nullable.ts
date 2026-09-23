// #106: a path through a link whose *declared* type is nullable is never a
// fact's key, whatever a guard narrowed it to. #104's first hoist read the
// narrowed type and put a null dereference ahead of a loop that never ran; the
// bounds proof reads the declared one for the same reason.
//
// A field is never narrowed in this language (`l.next.xs` is refused: "only a
// local is narrowed"), so the one nullable link a path can meet is its root.
// `narrowed` and `plain` are the same loop over a `Holder | null` and a
// `Holder`: tests/run.js asserts the first keeps its check and the second
// does not, which is the declared-type rule and nothing else.
//
// `main` is the round trip: `h` is declared `Holder | null`, rebound on the
// second pass to a holder of one element, and read at `h.xs[1]`. It must exit 1
// with "index out of range: 1 >= 1" on stderr, after "1" on stdout.
class Holder {
  xs: i32[];
  constructor(xs: i32[]) {
    this.xs = xs;
  }
}

export const narrowed = (h: Holder | null): i32 => {
  let s = 0;
  if (h !== null) {
    let i = 0;
    while (i < h.xs.length) {
      s = s + h.xs[i];
      i = i + 1;
    }
  }
  return s;
};

export const plain = (h: Holder): i32 => {
  let s = 0;
  let i = 0;
  while (i < h.xs.length) {
    s = s + h.xs[i];
    i = i + 1;
  }
  return s;
};

export const main = (): number => {
  const other: Holder | null = new Holder([7]);
  let h: Holder | null = new Holder([1, 2, 3]);
  let i = 0;
  while (h !== null && i < h.xs.length) {
    if (i === 1) {
      h = other;
    }
    if (h !== null) {
      console.log(`${h.xs[i]}`);
    }
    i = i + 1;
  }
  return narrowed(null) + plain(new Holder([]));
};
