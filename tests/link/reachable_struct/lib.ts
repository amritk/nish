// A class whose members hand out values of another class. An importer of
// `Registry` alone can hold, call and read `Entry` values without ever naming
// `Entry`, so its layout and its symbols have to reach that module too.
export class Entry {
  key: string;
  count: number;

  constructor(key: string, count: number) {
    this.key = key;
    this.count = count;
  }

  label(): string {
    return `${this.key}=${this.count}`;
  }
}

export class Registry {
  entries: Entry[];

  constructor() {
    this.entries = [];
  }

  add(key: string, count: number): void {
    this.entries.push(new Entry(key, count));
  }

  all(): Entry[] {
    return this.entries;
  }

  first(): Entry | null {
    return this.entries.length > 0 ? this.entries[0] : null;
  }
}
