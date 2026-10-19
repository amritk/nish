// The region of `using g = m.lock(), s = scope()` is the scope's, so its
// message names `s`, the scope's declarator, not `g`, the first one.
import { Mutex, scope } from "nish/threads";
class C { n: i32 = 0; }
const work = (x: i32): i32 => x + 1;
export function main(): void {
  const m = new Mutex<C>(new C());
  using g = m.lock(), s = scope();
  s.spawn(work, 1);
  g.value.n = 1;
}
