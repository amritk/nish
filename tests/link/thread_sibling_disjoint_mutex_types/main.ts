// Round 2 of the atomics review: sibling scopes whose tasks lock `Mutex`es of
// two different types share no lock, so the sibling rule accepts them, and each
// lock's data ends where every add has landed, natively and under Node.
import { Mutex, scope } from "nish/threads";
class Hits {
  n: i32 = 0;
}
class Bytes {
  total: i64 = 0;
}
const countHits = (m: Mutex<Hits>): i32 => {
  for (let i: i32 = 0; i < 500; i++) {
    using g = m.lock();
    g.value.n = g.value.n + 2;
  }
  return 0;
};
const countBytes = (m: Mutex<Bytes>): i32 => {
  for (let i: i64 = 0; i < 500; i++) {
    using g = m.lock();
    g.value.total = g.value.total + i;
  }
  return 0;
};
const hitsOf = (m: Mutex<Hits>): i32 => {
  using g = m.lock();
  return g.value.n;
};
const bytesOf = (m: Mutex<Bytes>): i64 => {
  using g = m.lock();
  return g.value.total;
};
export const main = (): i32 => {
  const hits = new Mutex<Hits>(new Hits());
  const bytes = new Mutex<Bytes>(new Bytes());
  const h: i32[] = [0, 0];
  const b: i32[] = [0, 0];
  {
    using s = scope(), t = scope();
    s.spawn(countHits, hits, h, 0);
    s.spawn(countHits, hits, h, 1);
    t.spawn(countBytes, bytes, b, 0);
    t.spawn(countBytes, bytes, b, 1);
  }
  console.log(`${hitsOf(hits)} ${bytesOf(bytes)}`);
  return 0;
};
