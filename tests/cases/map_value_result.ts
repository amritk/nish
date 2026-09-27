// #233: a `Map` whose value is a `Result` compiles and runs. Storing, moving
// and dropping a value in `std/collections.ts` is not a discard of a
// `Result`: `items[to] = items[from]` is a move, and `items.pop()` drops a
// `T`, which is what its template declared. A missed `get` answers the null
// pointer a `Result` is when it is absent. A sliding window of 16 live keys
// over 400 inserts deletes enough entries to compact the table in place.
const parse = (n: i32): Result<i32, string> => (n % 3 === 0 ? Err(`bad ${n}`) : Ok(n * 10));

const show = (m: Map<string, Result<i32, string>>, key: string): string => {
  const r = m.get(key);
  if (r === undefined) {
    return `${key}: absent`;
  }
  return r.isOk() ? `${key}: ok ${r.value}` : `${key}: err ${r.error}`;
};

export const main = (): i32 => {
  const m = new Map<string, Result<i32, string>>();
  const window: i32 = 16;
  for (let i: i32 = 0; i < 400; i++) {
    m.set(`k${i}`, parse(i));
    if (i >= window) {
      m.delete(`k${i - window}`);
    }
  }
  m.set("k390", parse(1));
  console.log(`${m.size} ${m.has("k399")} ${m.has("k383")} ${m.has("k0")}`);
  console.log(show(m, "k390"));
  console.log(show(m, "k398"));
  console.log(show(m, "k399"));
  console.log(show(m, "k5"));
  return 0;
};
