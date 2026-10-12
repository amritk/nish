// NL2491: a `?.` chain whose last link is `Map.get`.
class Holder {
  counts: Map<string, i32>;
  constructor() {
    this.counts = new Map<string, i32>();
  }
}

export const f = (h: Holder | null): i32 => h?.counts.get("a") ?? 0;
