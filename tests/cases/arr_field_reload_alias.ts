// What the element tag must not hide. Each function reads a field or a header
// that really did change between two element accesses, so a stale value kept
// across the change would print a different number: a field reassigned through
// a second reference to the same object, `push` inside a callee growing the
// array that a field holds, and a `(Disk | null)[]` beside a pointer field
// (AWFY Towers' shape), where the element and the field share an LLVM type.
export class Disk {
  size: i32;
  next: Disk | null;

  constructor(size: i32) {
    this.size = size;
    this.next = null;
  }
}

export class Holder {
  v: i32[];
  piles: (Disk | null)[];

  constructor() {
    this.v = [0];
    this.piles = [null, null];
  }
}

const grow = (h: Holder): void => {
  h.v.push(7);
};

const viaAlias = (h: Holder, other: Holder): i32 => {
  h.v[0] = 1;
  other.v = [5, 6];
  h.v[0] = h.v[0] + 1;
  return h.v[0] * 10 + h.v.length;
};

const viaCallee = (h: Holder): i32 => {
  h.v[0] = 3;
  grow(h);
  return h.v.length * 10 + h.v[h.v.length - 1];
};

const viaPointers = (h: Holder): i32 => {
  const top = new Disk(4);
  h.piles[0] = top;
  const under = new Disk(9);
  top.next = under;
  h.piles[1] = top.next;
  const first = h.piles[0];
  const second = h.piles[1];
  if (first === null || second === null) {
    return -1;
  }
  const below = first.next;
  if (below === null) {
    return -2;
  }
  return first.size * 100 + second.size * 10 + below.size;
};

export const test = (): i32 => {
  const h = new Holder();
  const a = viaAlias(h, h);
  const b = viaCallee(new Holder());
  const c = viaPointers(new Holder());
  return a * 1000000 + b * 1000 + c;
};
