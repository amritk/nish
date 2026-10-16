// A task answers a number, a `boolean`, an enum, a `string` or a scalar
// array, which the join copies: a class value it built would point into its
// arena, freed when the thread exits, and its fields are not copied.
import { scope } from "nish/threads";

class Tag {
  n: i32 = 0;
}

const label = (n: i32): Tag => new Tag();

export const main = (): i32 => {
  const out: Tag[] = [new Tag()];
  {
    using s = scope();
    s.spawn(label, 1, out, 0);
  }
  return out[0].n;
};
