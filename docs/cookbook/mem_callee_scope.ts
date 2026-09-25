// `size` allocates nothing itself: `chain` builds the list and `size` keeps a
// number. `n` is the only thing it was handed and cannot hold a pointer, so
// the list cannot outlive the call, and `size` brackets itself with the arena
// scope. `chain` returns its list, so it gets none.
class Cell {
  v: i32;
  next: Cell | null = null;

  constructor(v: i32) {
    this.v = v;
  }
}

const chain = (n: i32): Cell | null => {
  let head: Cell | null = null;
  for (let i = 0; i < n; i++) {
    const c = new Cell(i);
    c.next = head;
    head = c;
  }
  return head;
};

export const size = (n: i32): i32 => {
  let k = 0;
  let p = chain(n);
  while (p !== null) {
    k = k + 1;
    p = p.next;
  }
  return k;
};
