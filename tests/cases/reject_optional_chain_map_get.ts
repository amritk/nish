// A chain that ends in `get` would make one `??` default a `null` link and a
// missing key at once.
class Holder {
  counts: Map<string, i32>;
  constructor() {
    this.counts = new Map<string, i32>();
  }
}

export const f = (h: Holder | null): i32 => h?.counts.get("a") ?? 0;
