class Link {
  next: Link | null = null;
}

export class Pile {
  tops: (Link | null)[];

  constructor() {
    this.tops = [null];
  }

  drop(): Link | null {
    const top = this.tops[0];
    if (top !== null) {
      this.tops[0] = top.next;
      top.next = null;
    }
    return this.tops[0];
  }
}
