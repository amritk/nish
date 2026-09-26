// WP32 S5 (docs/wp32-map.md §9.2): `reserve(m, n)` from `nish/map`. Natively
// it is the table's `reserveSlots`, which grows the bucket table once so that
// `n` entries fit without a rebuild; under Node it does nothing. Only the
// speed may differ: every line printed is the same either way, and a count
// that is not positive does nothing on both.
//
// Natively the call's facts are `reserveSlots`'s, not those of the empty body
// Node runs: `presize` writes its map, so the parameter is not `readonly`, and
// the bucket array it allocates is kept by the map, so the loop below, whose
// passes also build a string, does not release its pass's arena memory at the
// end of each pass. The strings built afterwards would land on the buckets if
// it did.
import { reserve } from "nish/map";

const presize = (m: Map<number, number>, n: number): void => {
  reserve(m, n);
};

export const main = (): i32 => {
  const m = new Map<number, number>();
  presize(m, 0);
  presize(m, -5);
  m.set(1, 10);
  m.set(2, 20);
  for (let round = 1; round <= 4; round++) {
    const label = `round ${round}`;
    reserve(m, round * 300 + label.length);
  }
  const junk: string[] = [];
  for (let i = 0; i < 200; i++) {
    junk.push(`overwrite ${i}`);
  }
  for (let i = 7; i <= 1000; i++) {
    m.set(i, i * 10);
  }
  presize(m, 10);
  m.delete(2);
  let sum = 0;
  for (const v of m.values()) {
    sum = sum + v;
  }
  console.log(`${m.size} ${m.get(1) ?? -1} ${m.has(2)} ${m.get(1000) ?? -1} ${sum} ${junk.length}`);
  return 0;
};
