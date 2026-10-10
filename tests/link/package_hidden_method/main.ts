// #442: a call to a method of a non-exported class from another package passed
// the checker and failed at link, `undefined symbol: pkg_q.Space.unsent`. The
// class's values reach this module through `Conn.space`, which the language
// allows (docs/LANGUAGE.md, "Linkage"), so its methods are callable here.
import { Conn } from "pkg_q";

export const main = (): i32 => {
  const conn = new Conn();
  const initial = conn.space(0);
  console.log(initial.name());
  console.log(initial.unsent(8));
  const taken = conn.space(1).take(4);
  if (taken.isErr()) {
    return 1;
  }
  console.log(taken.value);
  const refused = initial.take(5);
  if (refused.ok) {
    return 1;
  }
  console.log(refused.error);
  console.log(conn.space(1).either("low", "high"));
  return conn.weight() - 26;
};
