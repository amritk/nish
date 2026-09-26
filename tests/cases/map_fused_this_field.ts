// WP32 S5 (docs/wp32-map.md §9.1): the receiver may be a `this.<field>` path
// as well as a local, when both calls spell it the same way. Both the update
// and the guarded insert here are one probe each.
class Tally {
  counts: Map<string, number>;
  seen: Set<string>;
  firsts: string[];

  constructor() {
    this.counts = new Map<string, number>();
    this.seen = new Set<string>();
    this.firsts = [];
  }

  note(w: string): void {
    this.counts.set(w, (this.counts.get(w) ?? 0) + 1);
    if (!this.seen.has(w)) {
      this.seen.add(w);
      this.firsts.push(w);
    }
  }
}

export const main = (): i32 => {
  const t = new Tally();
  for (const w of ["b", "a", "b", "b", "c", "a"]) {
    t.note(w);
  }
  for (const w of t.firsts) {
    console.log(`${w} ${t.counts.get(w) ?? -1}`);
  }
  return 0;
};
