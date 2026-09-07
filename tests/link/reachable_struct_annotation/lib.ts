export class Entry {
  count: number;

  constructor(count: number) {
    this.count = count;
  }
}

export class Registry {
  entry: Entry;

  constructor() {
    this.entry = new Entry(1);
  }

  head(): Entry {
    return this.entry;
  }
}
