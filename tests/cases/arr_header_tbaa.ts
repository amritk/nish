// A class-field store cannot write an array's header, and the header's own
// `!tbaa` subtree is what tells LLVM so (`headerTbaa`, self/tbaa.ts). This is
// AWFY Towers' `moveTopDisk`: `popDiskFrom` and `pushDisk` inlined into one
// move. Before the header carried a tag, `opt -O3` reloaded `this.piles`'s
// `data` after `top.next = null` and again after `disk.next = top`, and the
// checked build reloaded its `length` the same way. `tests/run.js` pins what a
// golden cannot state: after `opt -O3` the move loads `data` once and `length`
// once.
class Disk {
  size: i32;
  next: Disk | null = null;

  constructor(size: i32) {
    this.size = size;
  }
}

export class Towers {
  piles: (Disk | null)[];
  moves: i32 = 0;

  constructor() {
    this.piles = new Array<Disk | null>(3);
  }

  pushDisk(disk: Disk, pile: i32): void {
    const top = this.piles[pile];
    if (top !== null && disk.size >= top.size) {
      panic("Cannot put a big disk on a smaller one");
    }
    disk.next = top;
    this.piles[pile] = disk;
  }

  popDiskFrom(pile: i32): Disk {
    const top = this.piles[pile];
    if (top === null) {
      panic("Attempting to remove a disk from an empty pile");
    }
    this.piles[pile] = top.next;
    top.next = null;
    return top;
  }

  moveTopDisk(fromPile: i32, toPile: i32): void {
    this.pushDisk(this.popDiskFrom(fromPile), toPile);
    this.moves += 1;
  }
}

export const test = (): i32 => {
  const t = new Towers();
  t.pushDisk(new Disk(2), 0);
  t.pushDisk(new Disk(1), 0);
  t.moveTopDisk(0, 1);
  t.moveTopDisk(0, 2);
  t.moveTopDisk(1, 2);
  const top = t.piles[2];
  if (top === null) {
    return -1;
  }
  return t.moves * 100 + top.size * 10 + t.piles.length;
};
