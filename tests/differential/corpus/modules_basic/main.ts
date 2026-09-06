// Multi-module program: named imports, an `as` rename, and imports used across modules.
import { square, cube as pow3, wrapMul } from "./math";
import { shout, join } from "./text";

export function main(): number {
  console.log(square(12));
  console.log(pow3(-3));
  console.log(wrapMul(65536, 65536));
  console.log(wrapMul(46341, 46341));
  console.log(shout("hello"));
  console.log(join(shout("a"), shout("b")));
  let total = 0;
  for (let i = 0; i < 10; i++) {
    total += square(i) - pow3(i);
  }
  console.log(total);
  console.log(join(`${square(3)}`, `${pow3(3)}`));
  return square(2) + 1;
}
