// The Towers move again, compiled with `--threads`. The flag moves the arena
// into thread-local storage and changes nothing about which allocation a
// header access reaches, so the header tags are the same ones and the answer
// is the same one: there is no language surface that shares an array between
// threads, and a data race would be undefined behaviour with or without a tag.
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
