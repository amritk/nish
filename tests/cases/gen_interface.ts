// A generic interface is a struct with fields and nothing else, so an object
// literal takes its type from the annotation exactly as a monomorphic one does
// and `Pair$i32$str` is the only new thing about it.
interface Pair<A, B> {
  first: A;
  second: B;
}

export const test = (): number => {
  const p: Pair<i32, string> = { first: 7, second: "hi" };
  console.log(p.second);
  return p.first;
};
