// #233: a `Map` whose value is a `Result` small enough to travel as one word
// (docs/wp17-result-abi.md). The table's own methods take and answer it
// packed, so every call the emitter writes into them by hand packs it or
// unpacks it as an ordinary call does: `valueAt` behind `get`, `values()` and
// `getOrInsert`, and `insertAt` / `setValueAt` behind a fused update.
import { getOrInsert } from "nish/map";

const check = (n: i32): Result<i32, i32> => (n % 2 === 0 ? Ok(n) : Err(-n));

const show = (r: Result<i32, i32>): string => (r.isOk() ? `ok ${r.value}` : `err ${r.error}`);

export const main = (): i32 => {
  const m = new Map<i32, Result<i32, i32>>();
  for (let i: i32 = 0; i < 6; i++) {
    m.set(i, check(i));
  }
  m.delete(4);
  const two = m.get(2);
  const four = m.get(4);
  if (two !== undefined && four === undefined) {
    console.log(`${show(two)} absent`);
  }
  const hundred = check(100);
  const eight = check(8);
  m.set(3, m.get(3) ?? hundred);
  m.set(7, m.get(7) ?? eight);
  if (m.has(0)) {
    m.set(0, hundred);
  }
  console.log(show(getOrInsert(m, 1, check(10))));
  console.log(show(getOrInsert(m, 9, check(10))));
  const parts: string[] = [];
  for (const r of m.values()) {
    parts.push(show(r));
  }
  console.log(`${m.size} ${parts.join(";")}`);
  return 0;
};
