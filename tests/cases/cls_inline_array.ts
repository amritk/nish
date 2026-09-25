// A fixed-length array field is stored inside its object (docs/LANGUAGE.md,
// "Fixed-length array fields are stored inline"). Every assignment is a fresh
// array of a literal length -- `[]`, a literal, `new Array` -- and the field is
// only indexed and asked its `.length`, so `Board` holds the header and eight
// slots itself. `this.cells[i]` is then a load at a constant offset from
// `this`, with no field pointer and no `data` to read first.
//
// Reference semantics are unchanged: a `Board` is still a pointer, so one
// held in an array and one handed to a function are the same object.
class Board {
  cells: i32[];
  marks: boolean[];
  moves: i32 = 0;

  constructor() {
    this.cells = [];
    this.marks = [false, false, false];
  }

  reset(): void {
    this.cells = new Array<i32>(8);
    this.moves = 0;
  }

  mark(i: i32, v: i32): void {
    this.cells[i] = v;
    this.marks[i % 3] = true;
    this.moves += 1;
  }

  sum(): i32 {
    let total = 0;
    for (let i = 0; i < this.cells.length; i += 1) {
      total += this.cells[i];
    }
    return total;
  }
}

const bump = (b: Board, i: i32): void => {
  b.cells[i] += 100;
};

const marked = (b: Board): i32 => {
  let n = 0;
  for (let i = 0; i < b.marks.length; i += 1) {
    if (b.marks[i]) {
      n += 1;
    }
  }
  return n;
};

export const main = (): number => {
  const boards: Board[] = [new Board(), new Board()];
  console.log(`${boards[0].cells.length} ${boards[0].marks.length}`);
  boards[0].reset();
  boards[1].reset();
  boards[0].mark(2, 5);
  boards[0].mark(7, 9);
  bump(boards[0], 2);
  boards[1].mark(0, 1);
  console.log(`${boards[0].cells.length} ${boards[0].sum()} ${boards[1].sum()} ${marked(boards[0])}`);
  // The same object through the array and through a local.
  const b = boards[0];
  b.cells[0] = 3;
  console.log(`${boards[0].cells[0]} ${boards[0].moves}`);
  // Reassigning clears the slots, as a fresh `new Array` would have.
  boards[0].reset();
  console.log(`${boards[0].sum()} ${boards[1].sum()}`);
  // An object that does not escape keeps its slots on the stack.
  const local = new Board();
  local.reset();
  local.mark(1, 4);
  return local.sum() === 4 ? 0 : 1;
};
